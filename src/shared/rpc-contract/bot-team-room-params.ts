import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const BotTeamTaskSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  title: z.string(),
  prompt: z.string(),
  ownerBotId: z.string(),
  /** Null until the task starts: it waits in Todo with no agent working on it. */
  sessionId: z.string().nullable()
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
  text: requiredString('Missing message text')
})

export const BotTeamRoomSelector = z.object({
  teamId: requiredString('Missing team id')
})

export const BotTeamTaskStart = z.object({
  taskId: requiredString('Missing task id')
})

export type BotTeamTask = z.output<typeof BotTeamTaskSchema>
export type BotTeamMessage = z.output<typeof BotTeamMessageSchema>
export type BotTeamTaskInput = z.output<typeof BotTeamTaskCreate>
export type BotTeamMessageInput = z.output<typeof BotTeamMessagePost> & {
  authorBotId: string | null
}
