import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import {
  createBotTeamRoutine,
  listBotTeamRoutineRuns,
  setBotTeamRoutinePaused
} from '../runtime/orchestration/db/bot-teams/bot-team-routine-store'
import { createBotTeamRoutineScheduler } from './bot-team-routine-scheduler'

const at = (month: number, day: number, hour = 0, minute = 0): number =>
  new Date(2026, month - 1, day, hour, minute).getTime()

describe('bot team routine scheduler', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
    vi.useRealTimers()
  })

  function setup(startTask = vi.fn(async () => undefined)) {
    db = new OrchestrationDb(':memory:')
    const database = db
    const team = database.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Nora', job: 'Writes', agent: 'claude' }]
    })
    let clock = at(11, 1, 12, 0)
    const scheduler = createBotTeamRoutineScheduler({
      getDb: () => database,
      startTask,
      now: () => clock
    })
    const routine = createBotTeamRoutine(
      database,
      {
        teamId: team.id,
        botId: team.bots[0].id,
        name: 'Monday check-in',
        prompt: 'List what is still open.',
        schedule: { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null }
      },
      clock
    )
    return {
      db: database,
      team,
      routine,
      scheduler,
      startTask,
      setClock: (value: number) => {
        clock = value
      }
    }
  }

  it('makes one task for the routine bot and starts it when the time comes', async () => {
    const { db, team, routine, scheduler, startTask, setClock } = setup()
    setClock(at(11, 2, 8, 59))
    await scheduler.tick()
    expect(startTask).not.toHaveBeenCalled()

    setClock(at(11, 2, 9, 0))
    await scheduler.tick()
    const tasks = db.listBotTeamTasks(team.id)
    expect(tasks).toEqual([
      expect.objectContaining({
        title: 'Monday check-in',
        prompt: 'List what is still open.',
        ownerBotId: team.bots[0].id,
        sessionId: null
      })
    ])
    expect(startTask).toHaveBeenCalledTimes(1)
    expect(startTask).toHaveBeenCalledWith(tasks[0].id)
    expect(listBotTeamRoutineRuns(db, routine.id)).toEqual([
      expect.objectContaining({
        scheduledFor: { date: '2026-11-02', time: '09:00' },
        taskId: tasks[0].id,
        error: null
      })
    ])
  })

  it('does not run the same time twice', async () => {
    const { db, team, scheduler, startTask, setClock } = setup()
    setClock(at(11, 2, 9, 0))
    await scheduler.tick()
    setClock(at(11, 2, 9, 1))
    await scheduler.tick()
    await scheduler.tick()
    expect(startTask).toHaveBeenCalledTimes(1)
    expect(db.listBotTeamTasks(team.id)).toHaveLength(1)
  })

  it('runs once on wake for every run missed while asleep, never a burst', async () => {
    const { db, team, routine, scheduler, startTask, setClock } = setup()
    // The computer slept from Sunday 1 Nov through Mondays 2, 9 and 16 Nov.
    setClock(at(11, 16, 20, 0))
    await scheduler.tick()
    expect(startTask).toHaveBeenCalledTimes(1)
    expect(db.listBotTeamTasks(team.id)).toHaveLength(1)
    expect(listBotTeamRoutineRuns(db, routine.id).map((run) => run.scheduledFor)).toEqual([
      { date: '2026-11-16', time: '09:00' }
    ])
  })

  it('keeps going after a restart without repeating a run', async () => {
    const { db, scheduler, startTask, setClock } = setup()
    setClock(at(11, 2, 9, 0))
    await scheduler.tick()
    const restarted = createBotTeamRoutineScheduler({
      getDb: () => db,
      startTask,
      now: () => at(11, 2, 9, 30)
    })
    await restarted.tick()
    expect(startTask).toHaveBeenCalledTimes(1)
    setClock(at(11, 9, 9, 0))
    await scheduler.tick()
    expect(startTask).toHaveBeenCalledTimes(2)
  })

  it('leaves the task in Todo and records why when it cannot start', async () => {
    const { db, team, routine, scheduler, setClock } = setup(
      vi.fn(async () => {
        throw new Error('No Claude login on this host.')
      })
    )
    setClock(at(11, 2, 9, 0))
    await scheduler.tick()
    const [task] = db.listBotTeamTasks(team.id)
    expect(task.sessionId).toBeNull()
    expect(listBotTeamRoutineRuns(db, routine.id)).toEqual([
      expect.objectContaining({ taskId: task.id, error: 'No Claude login on this host.' })
    ])
  })

  it('records a run, with no task, when the routine bot is gone', async () => {
    const { db, team, routine, scheduler, startTask, setClock } = setup()
    db.db.prepare('DELETE FROM bot_team_bots WHERE id = ?').run(routine.botId)
    setClock(at(11, 2, 9, 0))
    await scheduler.tick()
    expect(startTask).not.toHaveBeenCalled()
    expect(db.listBotTeamTasks(team.id)).toEqual([])
    expect(listBotTeamRoutineRuns(db, routine.id)).toEqual([
      expect.objectContaining({
        taskId: null,
        error: 'The routine’s bot is no longer on the team.'
      })
    ])
  })

  it('records why when its task cannot even be created', async () => {
    const { db, team, routine, scheduler, startTask, setClock } = setup()
    vi.spyOn(db, 'createBotTeamTask').mockImplementation(() => {
      throw new Error('SQLITE_BUSY: database is locked')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    setClock(at(11, 2, 9, 0))
    await scheduler.tick()
    expect(startTask).not.toHaveBeenCalled()
    expect(db.listBotTeamTasks(team.id)).toEqual([])
    expect(listBotTeamRoutineRuns(db, routine.id)).toEqual([
      expect.objectContaining({
        taskId: null,
        error: 'The routine’s task could not be created: SQLITE_BUSY: database is locked'
      })
    ])
  })

  it('keeps the task and records why when it could not be prepared to start', async () => {
    const { db, team, routine, scheduler, startTask, setClock } = setup()
    vi.spyOn(db, 'setBotTeamTaskStartNotes').mockImplementation(() => {
      throw new Error('disk full')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // Only a routine with a zone has a clock note to save.
    const due = Date.UTC(2026, 10, 2, 9, 0)
    db.db.prepare('UPDATE bot_team_routines SET time_zone = ?, next_run_at = ?').run('UTC', due)
    setClock(due)
    await scheduler.tick()
    const [task] = db.listBotTeamTasks(team.id)
    expect(startTask).not.toHaveBeenCalled()
    expect(listBotTeamRoutineRuns(db, routine.id)).toEqual([
      expect.objectContaining({
        taskId: task.id,
        error: 'The routine’s task was made but could not be prepared: disk full'
      })
    ])
  })

  it('never records a blank reason for a start that fails without a message', async () => {
    const { db, routine, scheduler, setClock } = setup(
      vi.fn(async () => {
        // oxlint-disable-next-line unicorn/error-message -- A blank message is the case under test.
        throw new Error('')
      })
    )
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    setClock(at(11, 2, 9, 0))
    await scheduler.tick()
    const [run] = listBotTeamRoutineRuns(db, routine.id)
    expect(run.error).toBe('No further detail was reported.')
  })

  it('logs a run that failed to start', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { scheduler, setClock } = setup(
      vi.fn(async () => {
        throw new Error('No Claude login on this host.')
      })
    )
    setClock(at(11, 2, 9, 0))
    await scheduler.tick()
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('routine run botrun_'),
      expect.any(Error)
    )
  })

  it('gives a run left with neither a task nor a reason its reason', async () => {
    const { db, routine, scheduler, setClock } = setup()
    // A claim whose host stopped before the task was made.
    db.db
      .prepare('INSERT INTO bot_team_routine_runs (id, routine_id, scheduled_for) VALUES (?, ?, ?)')
      .run('botrun_lost', routine.id, at(11, 2, 9, 0))
    setClock(at(11, 2, 9, 5))
    await scheduler.tick()
    const stored = db.db
      .prepare('SELECT task_id, error FROM bot_team_routine_runs WHERE id = ?')
      .get('botrun_lost')
    expect(stored).toEqual({
      task_id: null,
      error: expect.stringContaining('its task was never created')
    })
  })

  it('runs nothing while paused and keeps the history', async () => {
    const { db, routine, scheduler, startTask, setClock } = setup()
    setClock(at(11, 2, 9, 0))
    await scheduler.tick()
    setBotTeamRoutinePaused(db, routine.id, true, at(11, 3, 8, 0))
    setClock(at(11, 9, 9, 0))
    await scheduler.tick()
    expect(startTask).toHaveBeenCalledTimes(1)
    expect(listBotTeamRoutineRuns(db, routine.id)).toHaveLength(1)
  })

  it('checks on its own interval once started, and stops', async () => {
    vi.useFakeTimers()
    const { scheduler, startTask, setClock } = setup()
    scheduler.start()
    setClock(at(11, 2, 9, 0))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(startTask).toHaveBeenCalledTimes(1)
    scheduler.stop()
    setClock(at(11, 9, 9, 0))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(startTask).toHaveBeenCalledTimes(1)
  })

  it('waits for a database before it has anything to do', async () => {
    const scheduler = createBotTeamRoutineScheduler({
      getDb: () => null,
      startTask: vi.fn(),
      now: () => at(11, 2, 9, 0)
    })
    await expect(scheduler.tick()).resolves.toBeUndefined()
  })
})
