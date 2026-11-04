import { z } from 'zod'
import {
  BOT_TEAM_ROUTINE_FREQUENCIES,
  BOT_TEAM_ROUTINE_MAX_MONTH_DAY,
  onceRoutineRunAt
} from '../bot-team-routine-schedule'
import { isKnownTimeZone } from '../bot-team-routine-zone'
import { requiredString } from './rpc-param-primitives'

const WallTime = z.object({ date: z.string(), time: z.string() })

export const BotTeamRoutineScheduleSchema = z.object({
  frequency: z.enum(BOT_TEAM_ROUTINE_FREQUENCIES),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must look like 09:00'),
  /** Cron's days: 0 is Sunday. Used by weekly routines only. */
  weekday: z.number().int().min(0).max(6).nullable().default(null),
  /** Used by monthly routines only. */
  monthDay: z.number().int().min(1).max(BOT_TEAM_ROUTINE_MAX_MONTH_DAY).nullable().default(null),
  /** `YYYY-MM-DD`. Used by one-time routines only. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must look like 2026-11-04')
    .nullable()
    .optional(),
  /** IANA zone of whoever made the routine. Absent on routines from before zones: those use the host's clock. */
  timeZone: z.string().min(1).max(64).nullable().optional()
})

export const BotTeamRoutineSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  botId: z.string(),
  name: z.string(),
  prompt: z.string(),
  schedule: BotTeamRoutineScheduleSchema,
  paused: z.boolean(),
  /**
   * Null while paused, and once a one-time routine's moment has passed. On the routine's clock: its
   * zone, or the host's for a routine without one.
   */
  nextRun: WallTime.nullable(),
  /** The same moment in epoch ms, so a viewer can show it in their own zone. Absent from older hosts. */
  nextRunAt: z.number().nullable().optional(),
  lastRun: z
    .object({
      scheduledFor: WallTime,
      /** Epoch ms of `scheduledFor`. Absent from older hosts. */
      scheduledAt: z.number().optional(),
      taskId: z.string().nullable(),
      error: z.string().nullable()
    })
    .nullable()
})

export const BotTeamRoutineRunSchema = z.object({
  id: z.string(),
  routineId: z.string(),
  scheduledFor: WallTime,
  /** Epoch ms of `scheduledFor`. Absent from older hosts. */
  scheduledAt: z.number().optional(),
  taskId: z.string().nullable(),
  /** Why the run's task could not start; the task then waits in Todo. */
  error: z.string().nullable()
})

const RoutineFields = {
  botId: requiredString('Missing bot id'),
  name: requiredString('Missing routine name'),
  prompt: requiredString('Missing what the routine should do'),
  schedule: BotTeamRoutineScheduleSchema
}

function checkSchedule(
  { schedule }: { schedule: z.output<typeof BotTeamRoutineScheduleSchema> },
  ctx: z.RefinementCtx
): void {
  if (schedule.frequency === 'weekly' && schedule.weekday === null) {
    ctx.addIssue({ code: 'custom', message: 'Pick the day of the week', path: ['schedule'] })
  }
  if (schedule.frequency === 'monthly' && schedule.monthDay === null) {
    ctx.addIssue({ code: 'custom', message: 'Pick the day of the month', path: ['schedule'] })
  }
  if (schedule.timeZone && !isKnownTimeZone(schedule.timeZone)) {
    ctx.addIssue({ code: 'custom', message: 'Unknown time zone', path: ['schedule'] })
  }
  if (schedule.frequency === 'once' && onceRoutineRunAt(schedule) === null) {
    ctx.addIssue({ code: 'custom', message: 'Pick the day it runs', path: ['schedule'] })
  }
}

export const BotTeamRoutineCreate = z
  .object({ teamId: requiredString('Missing team id'), ...RoutineFields })
  .superRefine(checkSchedule)

/** Every field Edit routine saves; the team stays the routine's own. */
export const BotTeamRoutineUpdate = z
  .object({ routineId: requiredString('Missing routine id'), ...RoutineFields })
  .superRefine(checkSchedule)

export const BotTeamRoutineList = z.object({
  teamId: requiredString('Missing team id')
})

export const BotTeamRoutineSelector = z.object({
  routineId: requiredString('Missing routine id')
})

export const BotTeamRoutineSetPaused = BotTeamRoutineSelector.extend({
  paused: z.boolean()
})

export type BotTeamRoutineSchedule = z.output<typeof BotTeamRoutineScheduleSchema>
export type BotTeamRoutine = z.output<typeof BotTeamRoutineSchema>
export type BotTeamRoutineRun = z.output<typeof BotTeamRoutineRunSchema>
export type BotTeamRoutineInput = z.output<typeof BotTeamRoutineCreate>
export type BotTeamRoutineUpdateInput = z.output<typeof BotTeamRoutineUpdate>
