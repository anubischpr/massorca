import { afterEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import { MOBILE_RPC_METHOD_ALLOWLIST } from '../../runtime-rpc/runtime-rpc-mobile-method-allowlist'
import type { RpcContext } from '../core'
import {
  BOT_TEAM_ROUTINE_METHODS,
  botTeamCreateRoutineMethod,
  botTeamListRoutineRunsMethod,
  botTeamListRoutinesMethod,
  botTeamSetRoutinePausedMethod
} from './bot-team-routine-methods'

describe('botTeams routine methods', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
  })

  function setup() {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Nora', job: 'Writes', agent: 'claude' }]
    })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handlers read only the runtime's database.
    const ctx = { runtime: { getOrchestrationDb: () => db } } as unknown as RpcContext
    return { team, ctx }
  }

  it('creates, lists, pauses and resumes a routine, with its runs', async () => {
    const { team, ctx } = setup()
    const { routine } = await botTeamCreateRoutineMethod.handler(
      botTeamCreateRoutineMethod.params.parse({
        teamId: team.id,
        botId: team.bots[0].id,
        name: 'Monday check-in',
        prompt: 'List what is open.',
        schedule: { frequency: 'weekly', time: '09:00', weekday: 1 }
      }),
      ctx
    )
    expect(routine.paused).toBe(false)
    expect(await botTeamListRoutinesMethod.handler({ teamId: team.id }, ctx)).toEqual({
      routines: [routine]
    })

    const paused = await botTeamSetRoutinePausedMethod.handler(
      { routineId: routine.id, paused: true },
      ctx
    )
    expect(paused.routine).toMatchObject({ paused: true, nextRun: null })
    const resumed = await botTeamSetRoutinePausedMethod.handler(
      { routineId: routine.id, paused: false },
      ctx
    )
    expect(resumed.routine.paused).toBe(false)
    expect(resumed.routine.nextRun).not.toBeNull()

    expect(await botTeamListRoutineRunsMethod.handler({ routineId: routine.id }, ctx)).toEqual({
      runs: []
    })
  })

  it('needs a day for a weekly routine and a day of the month for a monthly one', () => {
    const { params } = botTeamCreateRoutineMethod
    const base = { teamId: 't', botId: 'b', name: 'n', prompt: 'p' }
    expect(() =>
      params.parse({ ...base, schedule: { frequency: 'weekly', time: '09:00' } })
    ).toThrow('Pick the day of the week')
    expect(() =>
      params.parse({ ...base, schedule: { frequency: 'monthly', time: '09:00' } })
    ).toThrow('Pick the day of the month')
    expect(() =>
      params.parse({ ...base, schedule: { frequency: 'monthly', time: '09:00', monthDay: 31 } })
    ).toThrow()
    expect(() => params.parse({ ...base, schedule: { frequency: 'daily', time: '9am' } })).toThrow(
      'Time must look like 09:00'
    )
  })

  it('are workspace methods the phone may call', () => {
    for (const method of BOT_TEAM_ROUTINE_METHODS) {
      expect(method.permission).toBe('workspace')
      expect(MOBILE_RPC_METHOD_ALLOWLIST.has(method.name)).toBe(true)
    }
  })
})
