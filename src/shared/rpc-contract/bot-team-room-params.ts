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

export const BotTeamProjectSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  goal: z.string()
})

export const BotTeamProjectCreate = z.object({
  teamId: requiredString('Missing team id'),
  name: requiredString('Missing project name'),
  goal: z.string().trim().default('')
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

export const BotTeamRoomSelector = z.object({
  teamId: requiredString('Missing team id')
})

export const BotTeamTaskStart = z.object({
  taskId: requiredString('Missing task id')
})

export type BotTeamTask = z.output<typeof BotTeamTaskSchema>
export type BotTeamProject = z.output<typeof BotTeamProjectSchema>
export type BotTeamProjectInput = z.output<typeof BotTeamProjectCreate>
export type BotTeamMessage = z.output<typeof BotTeamMessageSchema>
export type BotTeamTaskInput = z.output<typeof BotTeamTaskCreate>
export type BotTeamMessageInput = {
  teamId: string
  text: string
  authorBotId: string | null
}
