import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isArchivedBotTeamRoutine } from '../../../../shared/bot-team-routine-archive'
import {
  createBotTeamRoutine,
  listBotTeamRoutines,
  setBotTeamRoutinePaused
} from '../../orchestration/db/bot-teams/bot-team-routine-store'
import { updateBotTeamRoutine } from '../../orchestration/db/bot-teams/bot-team-routine-edit'
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

describe('a scheduled request like a routine the team already runs', () => {
  let db: OrchestrationDb | undefined
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    classify.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
    db?.close()
    db = undefined
  })

  function setup() {
    const database = new OrchestrationDb(':memory:')
    db = database
    const team = database.createBotTeam({
      name: 'Web',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [
        { name: 'Ana', job: 'Front-end developer', agent: 'claude' },
        { name: 'Leo', job: 'Back-end developer', agent: 'codex' }
      ]
    })
    const runtime = {
      getOrchestrationDb: () => database,
      getClientSettings: () => ({}),
      getAccountsSnapshot: () => ({ rateLimits: {} }),
      getCommitMessageAgentEnvironmentResolvers: () => undefined
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the post path reads only the runtime members set here.
    const ctx = { runtime } as unknown as RpcContext
    const post = (text: string, timeZone?: string) =>
      postBotTeamRequestOnHost(
        ctx,
        { teamId: team.id, text, start: true, ...(timeZone ? { timeZone } : {}) },
        async () => {
          throw new Error('not started')
        }
      )
    return { database, team, ana: team.bots[0]!, leo: team.bots[1]!, post }
  }

  it('a request that names other work is created as its own routine, and the first is left as it was', async () => {
    const { database, team, post } = setup()
    const first = await post('@Ana programa para mañana a las 10 la revisión del front')
    const second = await post('@Ana programa para mañana a las 17 la revisión del backend')
    expect(second.choice).toBeUndefined()
    expect(second.scheduled).toBeDefined()
    const routines = listBotTeamRoutines(database, team.id)
    expect(routines.map((routine) => routine.name)).toEqual([
      'programa para mañana a las 10 la revisión del front',
      'programa para mañana a las 17 la revisión del backend'
    ])
    expect(routines.map((routine) => isArchivedBotTeamRoutine(routine))).toEqual([false, false])
    expect(routines[0]).toMatchObject({
      id: first.scheduled?.routineId,
      nextRun: { date: '2026-11-04', time: '10:00' }
    })
  })

  it('asks whether the request reschedules the routine it is like, and creates nothing', async () => {
    const { database, team, ana, post } = setup()
    const first = await post('@Ana programa para mañana a las 10 la revisión del front')
    const second = await post('@Ana programa para mañana a las 15 la revisión del front')
    expect(second.scheduled).toBeUndefined()
    expect(second.task).toBeNull()
    expect(second.later).toBe(true)
    expect(second.choice).toEqual({
      kind: 'similar-routine',
      routineId: first.scheduled?.routineId,
      routineName: 'programa para mañana a las 10 la revisión del front',
      routineNextRun: { date: '2026-11-04', time: '10:00' },
      request: {
        botId: ana.id,
        name: 'programa para mañana a las 15 la revisión del front',
        prompt: '@Ana programa para mañana a las 15 la revisión del front',
        schedule: {
          frequency: 'once',
          time: '15:00',
          weekday: null,
          monthDay: null,
          date: '2026-11-04',
          timeZone: null
        }
      }
    })
    expect(listBotTeamRoutines(database, team.id)).toHaveLength(1)
  })

  it('carries the sender’s zone in the new moment the choice offers', async () => {
    const { post } = setup()
    await post('@Ana programa para mañana a las 10 la revisión del front', 'America/Bogota')
    const second = await post(
      '@Ana programa para mañana a las 15 la revisión del front',
      'America/Bogota'
    )
    expect(
      second.choice?.kind === 'similar-routine' && second.choice.request.schedule.timeZone
    ).toBe('America/Bogota')
  })

  it('creating the routine the choice carries makes the one the request named, as before', async () => {
    const { database, team, post } = setup()
    await post('@Ana programa para mañana a las 10 la revisión del front')
    const second = await post('@Ana programa para mañana a las 15 la revisión del front')
    if (second.choice?.kind !== 'similar-routine') {
      throw new Error('expected a similar-routine choice')
    }
    const created = createBotTeamRoutine(
      database,
      { teamId: team.id, ...second.choice.request },
      NOW.getTime()
    )
    expect(created).toMatchObject({
      name: 'programa para mañana a las 15 la revisión del front',
      nextRun: { date: '2026-11-04', time: '15:00' }
    })
    expect(listBotTeamRoutines(database, team.id)).toHaveLength(2)
  })

  it('rescheduling the routine the choice names moves its next run and keeps its name and bot', async () => {
    const { database, team, ana, post } = setup()
    const first = await post('@Ana programa para mañana a las 10 la revisión del front')
    const second = await post('@Ana programa para mañana a las 15 la revisión del front')
    if (second.choice?.kind !== 'similar-routine') {
      throw new Error('expected a similar-routine choice')
    }
    const moved = updateBotTeamRoutine(
      database,
      {
        routineId: second.choice.routineId,
        botId: ana.id,
        name: second.choice.routineName,
        prompt: '@Ana programa para mañana a las 10 la revisión del front',
        schedule: second.choice.request.schedule
      },
      NOW.getTime()
    )
    expect(moved).toMatchObject({
      id: first.scheduled?.routineId,
      botId: ana.id,
      name: 'programa para mañana a las 10 la revisión del front',
      nextRun: { date: '2026-11-04', time: '15:00' }
    })
    expect(listBotTeamRoutines(database, team.id)).toHaveLength(1)
  })

  it('asks about a similar routine another bot holds too, and creates nothing yet', async () => {
    const { database, team, post } = setup()
    await post('@Ana programa para mañana a las 10 la revisión del front')
    const second = await post('@Leo programa para mañana a las 15 la revisión del front')
    expect(second.choice?.kind).toBe('similar-routine')
    expect(second.scheduled).toBeUndefined()
    expect(listBotTeamRoutines(database, team.id)).toHaveLength(1)
  })

  it('a routine that is paused is not offered, so the request is created as before', async () => {
    const { database, team, post } = setup()
    const first = await post('@Ana programa para mañana a las 10 la revisión del front')
    setBotTeamRoutinePaused(database, first.scheduled?.routineId ?? '', true, NOW.getTime())
    const second = await post('@Ana programa para mañana a las 15 la revisión del front')
    expect(second.choice).toBeUndefined()
    expect(second.scheduled).toBeDefined()
    expect(listBotTeamRoutines(database, team.id)).toHaveLength(2)
  })
})
