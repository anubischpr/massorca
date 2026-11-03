import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

/** Where a remembered line came from: a task that taught it, or the person who told the team. */
export const BotTeamMemorySourceSchema = z.object({
  kind: z.enum(['task', 'person']),
  /** The task's title when `kind` is task. */
  taskTitle: z.string().nullable().default(null)
})

export const BotTeamMemoryEntrySchema = z.object({
  id: z.string(),
  teamId: z.string(),
  /** Null: the whole team's memory. A bot id: only that bot uses it. */
  botId: z.string().nullable(),
  text: z.string(),
  source: BotTeamMemorySourceSchema
})

export const BotTeamMemoryList = z.object({
  teamId: requiredString('Missing team id')
})

export const BotTeamMemoryDelete = z.object({
  memoryId: requiredString('Missing memory id')
})

export type BotTeamMemoryEntry = z.output<typeof BotTeamMemoryEntrySchema>
export type BotTeamMemoryInput = {
  teamId: string
  botId: string | null
  text: string
  source: BotTeamMemoryEntry['source']
}
