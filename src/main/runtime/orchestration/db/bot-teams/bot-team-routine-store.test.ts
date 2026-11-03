import { afterEach, describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../contract-constants'
import { OrchestrationDb } from '../orchestration-db'
import {
  claimDueBotTeamRoutines,
  createBotTeamRoutine,
  hasActiveBotTeamRoutine,
  listBotTeamRoutineRuns,
  listBotTeamRoutines,
  recordBotTeamRoutineRun,
  setBotTeamRoutinePaused
} from './bot-team-routine-store'

const at = (month: number, day: number, hour = 0, minute = 0): number =>
  new Date(2026, month - 1, day, hour, minute).getTime()

describe('bot team routine store', () => {
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
    const input = {
      teamId: team.id,
      botId: team.bots[0].id,
      name: 'Monday check-in',
      prompt: 'List what is still open.',
      schedule: { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null } as const
    }
    return { db, team, input }
  }

  it('is part of the schema', () => {
    const { db } = setup()
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(54)
    expect(db.db.prepare('PRAGMA user_version').get()).toEqual({ user_version: SCHEMA_VERSION })
  })

  it('keeps a routine with its next run on the host clock and no last run yet', () => {
    const { db, team, input } = setup()
    // Sunday 1 Nov: the next Monday 09:00 is the day after.
    const routine = createBotTeamRoutine(db, input, at(11, 1, 12, 0))
    expect(routine).toMatchObject({
      teamId: team.id,
      botId: input.botId,
      name: 'Monday check-in',
      prompt: 'List what is still open.',
      schedule: { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null },
      paused: false,
      nextRun: { date: '2026-11-02', time: '09:00' },
      lastRun: null
    })
    expect(listBotTeamRoutines(db, team.id)).toEqual([routine])
  })

  it('drops the day a frequency does not use', () => {
    const { db, input } = setup()
    const routine = createBotTeamRoutine(
      db,
      { ...input, schedule: { frequency: 'daily', time: '07:30', weekday: 3, monthDay: 9 } },
      at(11, 1, 12, 0)
    )
    expect(routine.schedule).toEqual({
      frequency: 'daily',
      time: '07:30',
      weekday: null,
      monthDay: null
    })
  })

  it('refuses a bot that is not on the team', () => {
    const { db, input } = setup()
    expect(() => createBotTeamRoutine(db, { ...input, botId: 'nobody' }, at(11, 1))).toThrow(
      'Bot nobody is not on team'
    )
  })

  it('claims a due routine once, whatever number of runs were missed', () => {
    const { db, team, input } = setup()
    const routine = createBotTeamRoutine(db, input, at(11, 1, 12, 0))
    expect(claimDueBotTeamRoutines(db, at(11, 2, 8, 59))).toEqual([])
    // Asleep through two Mondays: one claim, for the latest.
    const claimed = claimDueBotTeamRoutines(db, at(11, 17, 10, 0))
    expect(claimed).toHaveLength(1)
    expect(claimed[0].routine.id).toBe(routine.id)
    expect(claimed[0].scheduledFor).toBe(at(11, 16, 9, 0))
    expect(claimDueBotTeamRoutines(db, at(11, 17, 10, 1))).toEqual([])
    expect(listBotTeamRoutines(db, team.id)[0].nextRun).toEqual({
      date: '2026-11-23',
      time: '09:00'
    })
    expect(listBotTeamRoutineRuns(db, routine.id)).toEqual([
      expect.objectContaining({
        scheduledFor: { date: '2026-11-16', time: '09:00' },
        taskId: null,
        error: expect.stringContaining('interrupted')
      })
    ])
  })

  it('keeps each run with its task or the reason it did not start', () => {
    const { db, team, input } = setup()
    const routine = createBotTeamRoutine(db, input, at(11, 1, 12, 0))
    const [first] = claimDueBotTeamRoutines(db, at(11, 2, 9, 0))
    recordBotTeamRoutineRun(db, first.runId, { taskId: 'task-1', error: null })
    const [second] = claimDueBotTeamRoutines(db, at(11, 9, 9, 0))
    recordBotTeamRoutineRun(db, second.runId, { taskId: 'task-2', error: 'No login.' })
    expect(listBotTeamRoutineRuns(db, routine.id).map((run) => [run.taskId, run.error])).toEqual([
      ['task-2', 'No login.'],
      ['task-1', null]
    ])
    expect(listBotTeamRoutines(db, team.id)[0].lastRun).toEqual({
      scheduledFor: { date: '2026-11-09', time: '09:00' },
      taskId: 'task-2',
      error: 'No login.'
    })
  })

  it('pauses without losing history and resumes with no catch-up', () => {
    const { db, team, input } = setup()
    const routine = createBotTeamRoutine(db, input, at(11, 1, 12, 0))
    const [claim] = claimDueBotTeamRoutines(db, at(11, 2, 9, 0))
    recordBotTeamRoutineRun(db, claim.runId, { taskId: 'task-1', error: null })

    const paused = setBotTeamRoutinePaused(db, routine.id, true, at(11, 3, 8, 0))
    expect(paused).toMatchObject({ paused: true, nextRun: null })
    expect(claimDueBotTeamRoutines(db, at(11, 30, 9, 0))).toEqual([])
    expect(listBotTeamRoutineRuns(db, routine.id)).toHaveLength(1)

    // Resumed on Monday 30 Nov at noon: the Mondays in between are not run.
    const resumed = setBotTeamRoutinePaused(db, routine.id, false, at(11, 30, 12, 0))
    expect(resumed).toMatchObject({ paused: false, nextRun: { date: '2026-12-07', time: '09:00' } })
    expect(claimDueBotTeamRoutines(db, at(11, 30, 12, 1))).toEqual([])
    expect(listBotTeamRoutines(db, team.id)[0].lastRun?.taskId).toBe('task-1')
  })

  it('keeps the host busy only while a routine is on', () => {
    const { db, input } = setup()
    expect(hasActiveBotTeamRoutine(db)).toBe(false)
    const routine = createBotTeamRoutine(db, input, at(11, 1, 12, 0))
    expect(hasActiveBotTeamRoutine(db)).toBe(true)
    setBotTeamRoutinePaused(db, routine.id, true, at(11, 1, 13, 0))
    expect(hasActiveBotTeamRoutine(db)).toBe(false)
  })

  it('does not stop a team from being deleted, and forgets its routines afterwards', () => {
    const { db, team, input } = setup()
    const routine = createBotTeamRoutine(db, input, at(11, 1, 12, 0))
    const [claim] = claimDueBotTeamRoutines(db, at(11, 2, 9, 0))
    recordBotTeamRoutineRun(db, claim.runId, { taskId: 'task-1', error: null })
    db.deleteBotTeam(team.id)
    expect(claimDueBotTeamRoutines(db, at(11, 9, 9, 0))).toEqual([])
    expect(listBotTeamRoutines(db, team.id)).toEqual([])
    expect(listBotTeamRoutineRuns(db, routine.id)).toEqual([])
  })
})
