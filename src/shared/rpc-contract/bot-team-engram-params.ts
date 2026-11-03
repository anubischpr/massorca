import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const ENGRAM_QUERY_MAX_LENGTH = 200
export const ENGRAM_DEFAULT_LIMIT = 5
export const ENGRAM_MAX_LIMIT = 20

export const BotTeamEngramList = z.object({
  teamId: requiredString('Missing team id'),
  projectId: requiredString('Missing project id'),
  /** Absent or blank: the latest memories instead of a search. */
  query: z.string().max(ENGRAM_QUERY_MAX_LENGTH).optional(),
  limit: z.number().int().min(1).max(ENGRAM_MAX_LIMIT).optional(),
  /** The view's first load: import from the Engram server now, bypassing the five-minute throttle. */
  refresh: z.boolean().optional()
})

export const BotTeamEngramMemorySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string().optional(),
  excerpt: z.string(),
  createdAt: z.string().optional()
})

/**
 * unavailable: no engram CLI on the host. not-linked: workspaces off or no linked project.
 * refreshFailed: the server import failed, so the memories are local and may be stale.
 */
export const BotTeamEngramReplySchema = z.object({
  status: z.enum(['ok', 'unavailable', 'not-linked', 'failed']),
  projectName: z.string().optional(),
  memories: z.array(BotTeamEngramMemorySchema),
  refreshFailed: z.boolean().optional()
})

export type BotTeamEngramMemory = z.output<typeof BotTeamEngramMemorySchema>
export type BotTeamEngramReply = z.output<typeof BotTeamEngramReplySchema>
