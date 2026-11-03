import { z } from 'zod'
import {
  BOT_TEAM_ROUTINE_FREQUENCIES,
  hostWallTime,
  latestRoutineRunAtOrBefore,
  nextRoutineRunAfter,
  type BotTeamRoutineSchedule
} from '../../../../../shared/bot-team-routine-schedule'
import {
  BotTeamRoutineRunSchema,
  BotTeamRoutineSchema,
  type BotTeamRoutine,
  type BotTeamRoutineInput,
  type BotTeamRoutineRun
} from '../../../../../shared/rpc-contract/bot-team-routine-params'
import { generateId } from '../generated-id'
import type { OrchestrationDb } from '../orchestration-db'

// Plain functions over the database, not methods, so this store stays out of the shared method lists.

const RoutineRow = z.object({
  id: z.string(),
  team_id: z.string(),
  bot_id: z.string(),
  name: z.string(),
  prompt: z.string(),
  frequency: z.enum(BOT_TEAM_ROUTINE_FREQUENCIES),
  time_of_day: z.string(),
  weekday: z.number().nullable(),
  month_day: z.number().nullable(),
  // Why: absent until migration v61 runs on a database another build opened first.
  run_date: z.string().nullable().optional(),
  time_zone: z.string().nullable().optional(),
  paused: z.number(),
  next_run_at: z.number().nullable()
})
type RoutineRow = z.output<typeof RoutineRow>

const RunRow = z.object({
  id: z.string(),
  routine_id: z.string(),
  scheduled_for: z.number(),
  task_id: z.string().nullable(),
  error: z.string().nullable()
})

const INTERRUPTED_RUN = 'This run was interrupted before its task could start.'

function scheduleOf(row: RoutineRow): BotTeamRoutineSchedule {
  return {
    frequency: row.frequency,
    time: row.time_of_day,
    weekday: row.weekday,
    monthDay: row.month_day,
    date: row.run_date ?? null,
    timeZone: row.time_zone ?? null
  }
}

function toRun(row: z.output<typeof RunRow>, timeZone: string | null): BotTeamRoutineRun {
  return BotTeamRoutineRunSchema.parse({
    id: row.id,
    routineId: row.routine_id,
    scheduledFor: hostWallTime(row.scheduled_for, timeZone),
    scheduledAt: row.scheduled_for,
    taskId: row.task_id,
    // A claimed run with neither a task nor a reason never got as far as making its task.
    error: row.error ?? (row.task_id === null ? INTERRUPTED_RUN : null)
  })
}

function toRoutine(db: OrchestrationDb, row: RoutineRow): BotTeamRoutine {
  const last = db.db
    .prepare('SELECT * FROM bot_team_routine_runs WHERE routine_id = ? ORDER BY rowid DESC LIMIT 1')
    .get(row.id)
  const timeZone = row.time_zone ?? null
  const lastRun = last === undefined ? null : toRun(RunRow.parse(last), timeZone)
  const nextRunAt = row.paused === 1 ? null : row.next_run_at
  return BotTeamRoutineSchema.parse({
    id: row.id,
    teamId: row.team_id,
    botId: row.bot_id,
    name: row.name,
    prompt: row.prompt,
    schedule: scheduleOf(row),
    paused: row.paused === 1,
    nextRun: nextRunAt === null ? null : hostWallTime(nextRunAt, timeZone),
    nextRunAt,
    lastRun: lastRun && {
      scheduledFor: lastRun.scheduledFor,
      scheduledAt: lastRun.scheduledAt,
      taskId: lastRun.taskId,
      error: lastRun.error
    }
  })
}

function requireRow(db: OrchestrationDb, routineId: string): RoutineRow {
  const row = db.db.prepare('SELECT * FROM bot_team_routines WHERE id = ?').get(routineId)
  if (row === undefined) {
    throw new Error(`Routine ${routineId} was not found.`)
  }
  return RoutineRow.parse(row)
}

export function createBotTeamRoutine(
  db: OrchestrationDb,
  input: BotTeamRoutineInput,
  now: number
): BotTeamRoutine {
  const bot = db.db
    .prepare('SELECT id FROM bot_team_bots WHERE id = ? AND team_id = ?')
    .get(input.botId, input.teamId)
  if (bot === undefined) {
    throw new Error(`Bot ${input.botId} is not on team ${input.teamId}.`)
  }
  // A frequency keeps only the day it uses, so a stale day never changes when it runs.
  const schedule: BotTeamRoutineSchedule = {
    frequency: input.schedule.frequency,
    time: input.schedule.time,
    weekday: input.schedule.frequency === 'weekly' ? input.schedule.weekday : null,
    monthDay: input.schedule.frequency === 'monthly' ? input.schedule.monthDay : null,
    date: input.schedule.frequency === 'once' ? (input.schedule.date ?? null) : null,
    timeZone: input.schedule.timeZone ?? null
  }
  const id = generateId('botroutine')
  db.db
    .prepare(
      `INSERT INTO bot_team_routines
         (id, team_id, bot_id, name, prompt, frequency, time_of_day, weekday, month_day, run_date, time_zone, paused, created_at, next_run_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .run(
      id,
      input.teamId,
      input.botId,
      input.name,
      input.prompt,
      schedule.frequency,
      schedule.time,
      schedule.weekday,
      schedule.monthDay,
      schedule.date ?? null,
      schedule.timeZone ?? null,
      now,
      nextRoutineRunAfter(schedule, now)
    )
  return toRoutine(db, requireRow(db, id))
}

export function getBotTeamRoutine(db: OrchestrationDb, routineId: string): BotTeamRoutine {
  return toRoutine(db, requireRow(db, routineId))
}

export function listBotTeamRoutines(db: OrchestrationDb, teamId: string): BotTeamRoutine[] {
  return z
    .array(RoutineRow)
    .parse(
      db.db.prepare('SELECT * FROM bot_team_routines WHERE team_id = ? ORDER BY rowid').all(teamId)
    )
    .map((row) => toRoutine(db, row))
}

/** Newest first. Pausing a routine never removes its runs. */
export function listBotTeamRoutineRuns(
  db: OrchestrationDb,
  routineId: string,
  limit = 50
): BotTeamRoutineRun[] {
  const routine = db.db
    .prepare('SELECT time_zone FROM bot_team_routines WHERE id = ?')
    .get(routineId)
  const timeZone = z.object({ time_zone: z.string().nullable() }).safeParse(routine)
  return z
    .array(RunRow)
    .parse(
      db.db
        .prepare(
          'SELECT * FROM bot_team_routine_runs WHERE routine_id = ? ORDER BY rowid DESC LIMIT ?'
        )
        .all(routineId, limit)
    )
    .map((row) => toRun(row, timeZone.success ? timeZone.data.time_zone : null))
}

/** Resuming starts from now: what was due while it was paused is not run. */
export function setBotTeamRoutinePaused(
  db: OrchestrationDb,
  routineId: string,
  paused: boolean,
  now: number
): BotTeamRoutine {
  const row = requireRow(db, routineId)
  db.db
    .prepare('UPDATE bot_team_routines SET paused = ?, next_run_at = ? WHERE id = ?')
    .run(paused ? 1 : 0, paused ? null : nextRoutineRunAfter(scheduleOf(row), now), routineId)
  return toRoutine(db, requireRow(db, routineId))
}

/** A deleted team takes its routines and their runs with it. */
function forgetOrphanedBotTeamRoutines(db: OrchestrationDb): void {
  const orphaned = 'team_id NOT IN (SELECT id FROM bot_teams)'
  db.db
    .prepare(
      `DELETE FROM bot_team_routine_runs WHERE routine_id IN (SELECT id FROM bot_team_routines WHERE ${orphaned})`
    )
    .run()
  db.db.prepare(`DELETE FROM bot_team_routines WHERE ${orphaned}`).run()
}

export type ClaimedBotTeamRoutineRun = {
  runId: string
  routine: BotTeamRoutine
  scheduledFor: number
}

/**
 * Takes every routine that is due, once each: however many of its runs were missed (the computer
 * slept), only the latest is kept, and the next one moves past `now`. The claim is saved before the
 * task is made, so a crash in between can lose a run but never repeat one.
 */
export function claimDueBotTeamRoutines(
  db: OrchestrationDb,
  now: number
): ClaimedBotTeamRoutineRun[] {
  forgetOrphanedBotTeamRoutines(db)
  const due = z.array(RoutineRow).parse(
    db.db
      .prepare(
        `SELECT r.* FROM bot_team_routines r
           JOIN bot_teams t ON t.id = r.team_id
           WHERE r.paused = 0 AND r.next_run_at IS NOT NULL AND r.next_run_at <= ?
           ORDER BY r.next_run_at, r.rowid`
      )
      .all(now)
  )
  const claimed: ClaimedBotTeamRoutineRun[] = []
  for (const row of due) {
    const schedule = scheduleOf(row)
    const scheduledFor = latestRoutineRunAtOrBefore(schedule, (row.next_run_at ?? now) - 1, now)
    const next = nextRoutineRunAfter(schedule, now)
    const runId = generateId('botrun')
    db.db.exec('BEGIN IMMEDIATE')
    try {
      // Why: the desktop app and orcad may share this database; only the process that moves the time runs it.
      const moved = db.db
        .prepare('UPDATE bot_team_routines SET next_run_at = ? WHERE id = ? AND next_run_at = ?')
        .run(next, row.id, row.next_run_at)
      if (Number(moved.changes) === 0) {
        db.db.exec('COMMIT')
        continue
      }
      if (scheduledFor !== null) {
        db.db
          .prepare(
            'INSERT INTO bot_team_routine_runs (id, routine_id, scheduled_for) VALUES (?, ?, ?)'
          )
          .run(runId, row.id, scheduledFor)
      }
      db.db.exec('COMMIT')
    } catch (error) {
      db.db.exec('ROLLBACK')
      throw error
    }
    if (scheduledFor !== null) {
      claimed.push({ runId, routine: toRoutine(db, requireRow(db, row.id)), scheduledFor })
    }
  }
  return claimed
}

/** True while any team still on the host has a routine that will run again. */
export function hasActiveBotTeamRoutine(db: OrchestrationDb): boolean {
  return (
    db.db
      .prepare(
        `SELECT 1 FROM bot_team_routines r JOIN bot_teams t ON t.id = r.team_id
           WHERE r.paused = 0 AND r.next_run_at IS NOT NULL LIMIT 1`
      )
      .get() !== undefined
  )
}

/** What came of a claimed run: the task it made, and why that task could not start, if so. */
export function recordBotTeamRoutineRun(
  db: OrchestrationDb,
  runId: string,
  outcome: { taskId: string | null; error: string | null }
): void {
  db.db
    .prepare('UPDATE bot_team_routine_runs SET task_id = ?, error = ? WHERE id = ?')
    .run(outcome.taskId, outcome.error, runId)
}
