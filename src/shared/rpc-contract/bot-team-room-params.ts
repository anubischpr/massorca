import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const BotTeamTaskSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  title: z.string(),
  prompt: z.string(),
  ownerBotId: z.string(),
  /** Null until the task starts: it waits in Todo with no agent working on it. */
  sessionId: z.string().nullable(),
  // The default reads a host from before projects existed.
  projectId: z.string().nullable().default(null)
})

/** Where a project's code comes from: a repository that exists, or a new folder set up with git. */
export const BotTeamCodeSourceSchema = z.enum(['repo', 'folder'])

/** What a project's bots read before they start: the Brief on the design. */
export const BotTeamBriefSchema = z.object({
  requirements: z.array(z.string()),
  constraints: z.array(z.string()),
  decisions: z.array(z.string())
})

const EMPTY_BRIEF = { requirements: [], constraints: [], decisions: [] }

export const BotTeamProjectSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  goal: z.string(),
  // Null: not connected to code. The default reads a host from before code sources existed.
  codeSource: BotTeamCodeSourceSchema.nullable().default(null),
  // The defaults read a host from before briefs existed.
  brief: BotTeamBriefSchema.default(EMPTY_BRIEF),
  briefUpdatedAt: z.number().nullable().default(null)
})

export const BotTeamProjectCreate = z.object({
  teamId: requiredString('Missing team id'),
  name: requiredString('Missing project name'),
  goal: z.string().trim().default(''),
  codeSource: BotTeamCodeSourceSchema.nullable().default(null)
})

export const BotTeamProjectSetCodeSource = z.object({
  projectId: requiredString('Missing project id'),
  codeSource: BotTeamCodeSourceSchema
})

export const BotTeamProjectSetBrief = z.object({
  projectId: requiredString('Missing project id'),
  goal: z.string().trim(),
  brief: BotTeamBriefSchema
})

export const BotTeamTaskSetProject = z.object({
  taskId: requiredString('Missing task id'),
  projectId: z.string().min(1).nullable()
})

export const BotTeamMessageSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  /** Null when the person wrote it. */
  authorBotId: z.string().nullable(),
  text: z.string()
})

export const BotTeamTaskCreate = z.object({
  teamId: requiredString('Missing team id'),
  title: requiredString('Missing task title'),
  prompt: z.string().trim().default(''),
  ownerBotId: requiredString('Missing bot id')
})

export const BotTeamMessagePost = z.object({
  teamId: requiredString('Missing team id'),
  text: requiredString('Missing message text'),
  /** False saves the task to Todo without starting a bot. */
  start: z.boolean().default(true)
})

/** Files a request the room could not place by itself: to a bot, and to a team when `toTeamId` is set. */
export const BotTeamRequestAssign = z.object({
  teamId: requiredString('Missing team id'),
  text: requiredString('Missing request text'),
  /** Absent: the least busy bot of the receiving team takes it. */
  botId: z.string().min(1).optional(),
  toTeamId: z.string().min(1).optional(),
  start: z.boolean().default(true)
})

/** Gives an idle task to a bot of any team; its team follows the bot. */
export const BotTeamTaskReassign = z.object({
  taskId: requiredString('Missing task id'),
  botId: requiredString('Missing bot id'),
  start: z.boolean().default(true)
})

export const BotTeamRoomSelector = z.object({
  teamId: requiredString('Missing team id')
})

export const BotTeamTaskStart = z.object({
  taskId: requiredString('Missing task id')
})

export type BotTeamTask = z.output<typeof BotTeamTaskSchema>
export type BotTeamBrief = z.output<typeof BotTeamBriefSchema>
export type BotTeamCodeSource = z.output<typeof BotTeamCodeSourceSchema>
export type BotTeamProject = z.output<typeof BotTeamProjectSchema>
export type BotTeamProjectInput = z.output<typeof BotTeamProjectCreate>
export type BotTeamMessage = z.output<typeof BotTeamMessageSchema>
export type BotTeamTaskInput = z.output<typeof BotTeamTaskCreate>
export type BotTeamMessageInput = {
  teamId: string
  text: string
  authorBotId: string | null
}
