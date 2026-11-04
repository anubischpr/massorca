import { z } from 'zod'
import { BOT_TEAM_ROUTINE_FREQUENCIES } from '../bot-team-routine-schedule'

/** A window wider than this is refused, so one call stays small. */
export const BOT_TEAM_SCHEDULED_RUNS_MAX_DAYS = 62
/** The most runs one call returns; a longer list is cut at the window's earliest runs. */
export const BOT_TEAM_SCHEDULED_RUNS_LIMIT = 500

export const BotTeamScheduledRunsQuery = z
  .object({
    /** Epoch ms. Without includePast, runs before the host's now are never listed. */
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
    /** Omit for every team on the host. */
    teamId: z.string().min(1).optional(),
    /** Also list runs that already started, from the host's record of claimed runs. A host from before this flag ignores it. */
    includePast: z.boolean().optional()
  })
  .refine(({ from, to }) => to > from, { message: 'The window must end after it starts' })
  .refine(({ from, to }) => to - from <= BOT_TEAM_SCHEDULED_RUNS_MAX_DAYS * 86_400_000, {
    message: `The window can be at most ${BOT_TEAM_SCHEDULED_RUNS_MAX_DAYS} days`
  })

export const BotTeamScheduledRunSchema = z.object({
  routineId: z.string(),
  routineName: z.string(),
  teamId: z.string(),
  teamName: z.string(),
  botId: z.string(),
  botName: z.string(),
  /** The bot's agent id, for its icon. */
  botAgent: z.string(),
  /** Always null today: a routine's task is made without a project. Kept so a later host can fill it. */
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  frequency: z.enum(BOT_TEAM_ROUTINE_FREQUENCIES),
  /** Epoch ms of the run. */
  at: z.number(),
  /** The same moment as the host's clock reads it. A viewer places the run by `at`, in their own zone. */
  hostTime: z.object({ date: z.string(), time: z.string() }),
  /** The zone the routine was made in, when it has one; absent from older hosts. */
  timeZone: z.string().optional(),
  /** The same moment on the routine's clock, when it has a zone. */
  routineTime: z.object({ date: z.string(), time: z.string() }).optional()
})

export const BotTeamScheduledRunsResult = z.object({
  runs: z.array(BotTeamScheduledRunSchema),
  /** True when the window held more than the limit. */
  truncated: z.boolean()
})

export type BotTeamScheduledRun = z.output<typeof BotTeamScheduledRunSchema>
export type BotTeamScheduledRunsResult = z.output<typeof BotTeamScheduledRunsResult>
