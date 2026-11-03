import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listBotTeamScheduledRuns } from '../../../bot-teams/bot-team-scheduled-runs'
import { listBotTeamRoutines } from '../../orchestration/db/bot-teams/bot-team-routine-store'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import type { RpcContext } from '../core'

const classify = vi.hoisted(() =>
  vi.fn(async (_args: { prompt: string }): Promise<string | null> => null)
)
vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: classify,
  askBotAgentForBotTeamReply: vi.fn(async () => null)
}))

import { postBotTeamRequestOnHost } from './bot-team-post-request'

// Tuesday 3 Nov 2026, 11:00 on the host's clock.
const NOW = new Date(2026, 10, 3, 11, 0)

describe('a room request that names a day', () => {
  let db: OrchestrationDb | undefined
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    classify.mockReset()
    db?.close()
    db = undefined
  })

  async function post(text: string, timeZone?: string) {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Web',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [
        { name: 'Ana', job: 'Front-end developer', agent: 'claude' },
        { name: 'Leo', job: 'Back-end developer', agent: 'codex' }
      ]
    })
    const ctx = {
      runtime: {
        getOrchestrationDb: () => db,
        getClientSettings: () => ({}),
        getAccountsSnapshot: () => ({ rateLimits: {} }),
        getCommitMessageAgentEnvironmentResolvers: () => undefined
      }
    } as unknown as RpcContext
    const startTask = vi.fn(async () => {
      throw new Error('not started')
    })
    const result = await postBotTeamRequestOnHost(
      ctx,
      { teamId: team.id, text, start: true, ...(timeZone ? { timeZone } : {}) },
      startTask
    )
    return { db, team, result, startTask }
  }

  it('schedules the work the query read a day for, and the bot says when it starts', async () => {
    classify.mockResolvedValue(
      '{"kind":"bot","bots":["Ana"],"later":true,"when":"2026-11-04 10:00"}'
    )
    const { db, team, result, startTask } = await post(
      'Quiero que programen para mañana en Todo una revisión del front'
    )

    expect(classify.mock.calls[0]?.[0].prompt).toContain('Tuesday 2026-11-03 11:00')
    expect(result.task).toBeNull()
    expect(result.scheduled).toMatchObject({ date: '2026-11-04', time: '10:00' })
    expect(startTask).not.toHaveBeenCalled()
    expect(db.listBotTeamTasks(team.id)).toEqual([])
    const [routine] = listBotTeamRoutines(db, team.id)
    expect(routine).toMatchObject({
      botId: team.bots[0].id,
      prompt: 'Quiero que programen para mañana en Todo una revisión del front',
      schedule: { frequency: 'once', date: '2026-11-04', time: '10:00' },
      nextRun: { date: '2026-11-04', time: '10:00' }
    })
    const reply = db.listBotTeamMessages(team.id).at(-1)
    expect(reply?.authorBotId).toBe(team.bots[0].id)
    expect(reply?.text).toMatch(/^Programado para el .+ a las 10:00\./)
    // The Calendar reads it with no change on its side.
    const runs = listBotTeamScheduledRuns(
      db,
      { from: NOW.getTime(), to: NOW.getTime() + 7 * 86_400_000 },
      NOW.getTime()
    )
    expect(runs.runs.map((run) => [run.routineId, run.hostTime])).toEqual([
      [routine.id, { date: '2026-11-04', time: '10:00' }]
    ])
  })

  it('reads the day from the words when the query fails', async () => {
    classify.mockRejectedValue(new Error('router down'))
    const { db, team, result } = await post('@Ana schedule a front review for tomorrow at 3pm')
    expect(result.scheduled).toMatchObject({ date: '2026-11-04', time: '15:00' })
    expect(listBotTeamRoutines(db, team.id)[0].botId).toBe(team.bots[0].id)
    expect(db.listBotTeamMessages(team.id).at(-1)?.text).toMatch(/^Scheduled for .+ at 15:00\./)
  })

  it("reads the day and time on the sender's clock when the host is in another zone", async () => {
    // 03:00 UTC on 4 Nov is still 3 Nov, 22:00 in Bogota: "mañana" is the 4th there.
    vi.setSystemTime(Date.UTC(2026, 10, 4, 3, 0))
    classify.mockResolvedValue('{"kind":"bot","bots":["Ana"]}')
    const { db, team, result } = await post(
      'programen para mañana a las 10 una revisión del front',
      'America/Bogota'
    )
    expect(classify.mock.calls[0]?.[0].prompt).toContain('Tuesday 2026-11-03 22:00')
    expect(result.scheduled).toMatchObject({ date: '2026-11-04', time: '10:00' })
    const [routine] = listBotTeamRoutines(db, team.id)
    expect(routine.schedule.timeZone).toBe('America/Bogota')
    expect(routine.nextRunAt).toBe(Date.UTC(2026, 10, 4, 15, 0))
  })

  it('files a request that names no day as before', async () => {
    classify.mockResolvedValue('{"kind":"bot","bots":["Ana"]}')
    const { db, team, result, startTask } = await post('Revisen el front, por favor')
    expect(result.scheduled).toBeUndefined()
    expect(startTask).toHaveBeenCalled()
    expect(listBotTeamRoutines(db, team.id)).toEqual([])
  })
})
