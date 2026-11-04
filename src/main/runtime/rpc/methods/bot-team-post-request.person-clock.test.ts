import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import { listBotTeamRoutines } from '../../orchestration/db/bot-teams/bot-team-routine-store'
import type { RpcContext } from '../core'

const classify = vi.hoisted(() =>
  vi.fn(async (_args: { prompt: string }): Promise<string | null> => null)
)
const askBot = vi.hoisted(() =>
  vi.fn(async (_args: { prompt: string }): Promise<string | null> => null)
)
vi.mock('../../../bot-teams/bot-team-request-query', () => ({
  askDefaultAgentForBotTeamRequest: classify,
  askBotAgentForBotTeamReply: askBot
}))

import { postBotTeamRequestOnHost } from './bot-team-post-request'

// 04:38 UTC on Wednesday 4 Nov is 23:38 on Tuesday 3 Nov in Lima: "mañana" is the 4th there.
const LIMA_NIGHT = Date.UTC(2026, 10, 4, 4, 38)
const LIMA_CLOCK = 'Tuesday 2026-11-03 23:38 America/Lima'

describe("a room request read on the sender's clock, across the host's date boundary", () => {
  let db: OrchestrationDb | undefined
  beforeEach(() => {
    vi.useFakeTimers({ now: LIMA_NIGHT, toFake: ['Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    classify.mockReset()
    askBot.mockReset()
    db?.close()
    db = undefined
  })

  async function post(text: string, options: { timeZone?: string; start?: boolean } = {}) {
    db = new OrchestrationDb(':memory:')
    const database = db
    const web = database.createBotTeam({
      name: 'Web',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [
        { name: 'Ana', job: 'Front-end developer', agent: 'claude' },
        { name: 'Leo', job: 'Back-end developer', agent: 'codex' }
      ]
    })
    const data = database.createBotTeam({
      name: 'Datos',
      purpose: '',
      character: 'square',
      workspacesEnabled: false,
      bots: [{ name: 'Max', job: 'Data analyst', agent: 'claude' }]
    })
    const ctx = {
      runtime: {
        getOrchestrationDb: () => database,
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
      {
        teamId: web.id,
        text,
        start: options.start ?? true,
        ...(options.timeZone ? { timeZone: options.timeZone } : {})
      },
      startTask
    )
    return { db: database, web, data, result }
  }

  it('schedules "mañana" for the 4th while the person is still on the 3rd', async () => {
    classify.mockResolvedValue('{"kind":"bot","bots":["Ana"]}')
    const {
      db: database,
      web,
      result
    } = await post('programen para mañana a las 9 una revisión del front', {
      timeZone: 'America/Lima'
    })
    expect(classify.mock.calls[0]?.[0].prompt).toContain(LIMA_CLOCK)
    expect(result.scheduled).toMatchObject({ date: '2026-11-04', time: '09:00' })
    expect(listBotTeamRoutines(database, web.id)[0]?.schedule.timeZone).toBe('America/Lima')
  })

  // The VPS host runs on UTC and a laptop on its own zone; neither may move the person's "mañana".
  it.each([
    { host: 'UTC', at: LIMA_NIGHT, day: '2026-11-04' },
    { host: 'Asia/Tokyo', at: LIMA_NIGHT, day: '2026-11-04' },
    // 05:15 UTC on the 4th is 00:15 on the 4th in Lima: past midnight, "mañana" is the 5th.
    { host: 'UTC', at: Date.UTC(2026, 10, 4, 5, 15), day: '2026-11-05' },
    { host: 'Asia/Tokyo', at: Date.UTC(2026, 10, 4, 5, 15), day: '2026-11-05' }
  ])('reads "mañana" as $day on a $host host either side of Lima midnight', async (row) => {
    const hostZone = process.env.TZ
    process.env.TZ = row.host
    try {
      vi.setSystemTime(row.at)
      classify.mockResolvedValue('{"kind":"bot","bots":["Ana"]}')
      const { result } = await post('programen para mañana a las 9 una revisión del front', {
        timeZone: 'America/Lima'
      })
      expect(result.scheduled).toMatchObject({ date: row.day, time: '09:00' })
    } finally {
      process.env.TZ = hostZone
    }
  })

  it("files a request that names a day with the sender's clock in its start notes", async () => {
    classify.mockResolvedValue('{"kind":"bot","bots":["Ana"]}')
    const { db: database, result } = await post('Escribe el informe del front para mañana', {
      timeZone: 'America/Lima',
      start: false
    })
    expect(result.task).not.toBeNull()
    expect(database.getBotTeamTaskStartNotes(result.task?.id ?? '')).toContain(LIMA_CLOCK)
  })

  it("files a request sent to another team with the sender's clock", async () => {
    const {
      db: database,
      data,
      result
    } = await post('@Datos revisa el stock para mañana', {
      timeZone: 'America/Lima',
      start: false
    })
    expect(result.sentTo).toEqual({ teamId: data.id, teamName: 'Datos' })
    expect(database.getBotTeamTaskStartNotes(result.task?.id ?? '')).toContain(LIMA_CLOCK)
  })

  it("answers a question about a day on the sender's clock", async () => {
    classify.mockResolvedValue('{"kind":"conversation","bots":["Ana"]}')
    askBot.mockResolvedValue('Mañana es miércoles 4 de noviembre.')
    const {
      db: database,
      web,
      result
    } = await post('¿Qué día es mañana?', {
      timeZone: 'America/Lima'
    })
    expect(result.replying).toEqual({ botId: web.bots[0].id })
    await vi.waitFor(() =>
      expect(database.listBotTeamMessages(web.id).at(-1)?.text).toBe(
        'Mañana es miércoles 4 de noviembre.'
      )
    )
    expect(askBot.mock.calls[0]?.[0].prompt).toContain(LIMA_CLOCK)
  })

  it('files a request from a sender whose zone is unknown with no clock, as before', async () => {
    classify.mockResolvedValue('{"kind":"bot","bots":["Ana"]}')
    const { db: database, result } = await post('Escribe el informe del front para mañana', {
      start: false
    })
    expect(result.task).not.toBeNull()
    expect(database.getBotTeamTaskStartNotes(result.task?.id ?? '')).toBeNull()
  })
})
