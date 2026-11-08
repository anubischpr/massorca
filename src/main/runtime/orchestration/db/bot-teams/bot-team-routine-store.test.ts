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
import { deleteBotTeamRoutine, updateBotTeamRoutine } from './bot-team-routine-edit'

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
      {
        ...input,
        schedule: { frequency: 'daily', time: '07:30', weekday: 3, monthDay: 9, date: '2026-11-04' }
      },
      at(11, 1, 12, 0)
    )
    expect(routine.schedule).toEqual({
      frequency: 'daily',
      time: '07:30',
      weekday: null,
      monthDay: null,
      date: null,
      timeZone: null
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

  it('marks the task a run started, so the room keeps it at the time it ran', () => {
    const { db, team, input } = setup()
    createBotTeamRoutine(db, input, at(11, 1, 12, 0))
    const [run] = claimDueBotTeamRoutines(db, at(11, 2, 9, 0))
    const task = db.createBotTeamTask({
      teamId: team.id,
      title: 'Check-in',
      prompt: 'Say hello',
      ownerBotId: team.bots[0].id
    })
    const asked = db.createBotTeamTask({
      teamId: team.id,
      title: 'Flyer',
      prompt: 'Make the flyer',
      ownerBotId: team.bots[0].id
    })
    recordBotTeamRoutineRun(db, run.runId, { taskId: task.id, error: null })
    const listed = db.listBotTeamTasks(team.id)
    expect(listed.find((entry) => entry.id === task.id)?.fromRoutine).toBe(true)
    expect(listed.find((entry) => entry.id === asked.id)?.fromRoutine).toBe(false)
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
      scheduledAt: at(11, 9, 9, 0),
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

  it('runs a one-time routine once, then shows no next run and lets the host rest', () => {
    const { db, input } = setup()
    const once = {
      ...input,
      name: 'Front review',
      schedule: {
        frequency: 'once',
        time: '10:00',
        weekday: 3,
        monthDay: 4,
        date: '2026-11-04'
      } as const
    }
    const routine = createBotTeamRoutine(db, once, at(11, 3, 12, 0))
    // The days a one-time routine does not use are dropped.
    expect(routine.schedule).toEqual({
      frequency: 'once',
      time: '10:00',
      weekday: null,
      monthDay: null,
      date: '2026-11-04',
      timeZone: null
    })
    expect(routine.nextRun).toEqual({ date: '2026-11-04', time: '10:00' })
    expect(hasActiveBotTeamRoutine(db)).toBe(true)

    expect(claimDueBotTeamRoutines(db, at(11, 4, 9, 59))).toEqual([])
    const [claimed] = claimDueBotTeamRoutines(db, at(11, 4, 10, 1))
    expect(claimed.scheduledFor).toBe(at(11, 4, 10, 0))
    expect(claimed.routine.nextRun).toBeNull()
    expect(claimDueBotTeamRoutines(db, at(11, 12, 10, 0))).toEqual([])
    expect(hasActiveBotTeamRoutine(db)).toBe(false)
    // Resuming a past one-time routine does not run it again.
    setBotTeamRoutinePaused(db, routine.id, true, at(11, 5, 0, 0))
    expect(setBotTeamRoutinePaused(db, routine.id, false, at(11, 5, 0, 0)).nextRun).toBeNull()
  })

  it('edits a finished one-time routine with a new date, so it runs again', () => {
    const { db, team, input } = setup()
    const schedule = { frequency: 'once', time: '10:00', weekday: null, monthDay: null } as const
    const routine = createBotTeamRoutine(
      db,
      { ...input, schedule: { ...schedule, date: '2026-11-04' } },
      at(11, 3, 12, 0)
    )
    claimDueBotTeamRoutines(db, at(11, 4, 10, 1))
    expect(listBotTeamRoutines(db, team.id)[0]?.nextRun).toBeNull()
    const edited = updateBotTeamRoutine(
      db,
      {
        routineId: routine.id,
        botId: input.botId,
        name: 'Front review again',
        prompt: 'Review it again.',
        schedule: { ...schedule, weekday: 2, date: '2026-11-10' }
      },
      at(11, 5, 0, 0)
    )
    expect(edited).toMatchObject({
      name: 'Front review again',
      prompt: 'Review it again.',
      schedule: { frequency: 'once', weekday: null, date: '2026-11-10' },
      nextRun: { date: '2026-11-10', time: '10:00' }
    })
    expect(() =>
      updateBotTeamRoutine(db, { ...input, routineId: routine.id, botId: 'nobody' }, at(11, 5))
    ).toThrow(/is not on team/)
  })

  it('deletes a routine with its runs, and nothing else', () => {
    const { db, team, input } = setup()
    const kept = createBotTeamRoutine(db, { ...input, name: 'Kept' }, at(11, 1, 12, 0))
    const gone = createBotTeamRoutine(db, input, at(11, 1, 12, 0))
    for (const claimed of claimDueBotTeamRoutines(db, at(11, 2, 9, 1))) {
      recordBotTeamRoutineRun(db, claimed.runId, { taskId: 'task-1', error: null })
    }
    deleteBotTeamRoutine(db, gone.id)
    expect(listBotTeamRoutines(db, team.id).map((routine) => routine.id)).toEqual([kept.id])
    expect(listBotTeamRoutineRuns(db, gone.id)).toEqual([])
    expect(listBotTeamRoutineRuns(db, kept.id)).toHaveLength(1)
    expect(() => deleteBotTeamRoutine(db, gone.id)).toThrow(/was not found/)
  })

  it('runs a routine on the clock of the zone it was made in, whatever the host clock is', () => {
    const { db, input } = setup()
    // Made in Bogota (UTC-5, no DST) for Mondays at 09:00; the host may be anywhere.
    const routine = createBotTeamRoutine(
      db,
      { ...input, schedule: { ...input.schedule, timeZone: 'America/Bogota' } },
      Date.UTC(2026, 10, 1, 12, 0)
    )
    expect(routine.schedule.timeZone).toBe('America/Bogota')
    expect(routine.nextRun).toEqual({ date: '2026-11-02', time: '09:00' })
    expect(routine.nextRunAt).toBe(Date.UTC(2026, 10, 2, 14, 0))
    const [claimed] = claimDueBotTeamRoutines(db, Date.UTC(2026, 10, 2, 14, 1))
    expect(claimed.scheduledFor).toBe(Date.UTC(2026, 10, 2, 14, 0))
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
