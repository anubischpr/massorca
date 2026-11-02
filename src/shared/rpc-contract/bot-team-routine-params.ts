import { z } from 'zod'
import {
  BOT_TEAM_ROUTINE_FREQUENCIES,
  BOT_TEAM_ROUTINE_MAX_MONTH_DAY
} from '../bot-team-routine-schedule'
import { requiredString } from './rpc-param-primitives'

const WallTime = z.object({ date: z.string(), time: z.string() })

export const BotTeamRoutineScheduleSchema = z.object({
  frequency: z.enum(BOT_TEAM_ROUTINE_FREQUENCIES),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must look like 09:00'),
  /** Cron's days: 0 is Sunday. Used by weekly routines only. */
  weekday: z.number().int().min(0).max(6).nullable().default(null),
  /** Used by monthly routines only. */
  monthDay: z.number().int().min(1).max(BOT_TEAM_ROUTINE_MAX_MONTH_DAY).nullable().default(null)
})

export const BotTeamRoutineSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  botId: z.string(),
  name: z.string(),
  prompt: z.string(),
  schedule: BotTeamRoutineScheduleSchema,
  paused: z.boolean(),
  /** Null while paused. On the host's clock. */
  nextRun: WallTime.nullable(),
  lastRun: z
    .object({
      scheduledFor: WallTime,
      taskId: z.string().nullable(),
      error: z.string().nullable()
    })
    .nullable()
})

export const BotTeamRoutineRunSchema = z.object({
  id: z.string(),
  routineId: z.string(),
  scheduledFor: WallTime,
  taskId: z.string().nullable(),
  /** Why the run's task could not start; the task then waits in Todo. */
  error: z.string().nullable()
})

export const BotTeamRoutineCreate = z
  .object({
    teamId: requiredString('Missing team id'),
    botId: requiredString('Missing bot id'),
    name: requiredString('Missing routine name'),
    prompt: requiredString('Missing what the routine should do'),
    schedule: BotTeamRoutineScheduleSchema
  })
  .superRefine(({ schedule }, ctx) => {
    if (schedule.frequency === 'weekly' && schedule.weekday === null) {
      ctx.addIssue({ code: 'custom', message: 'Pick the day of the week', path: ['schedule'] })
    }
    if (schedule.frequency === 'monthly' && schedule.monthDay === null) {
      ctx.addIssue({ code: 'custom', message: 'Pick the day of the month', path: ['schedule'] })
    }
  })

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
