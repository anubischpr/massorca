import { z } from 'zod'
import {
  BotTeamMemoryEntrySchema,
  type BotTeamMemoryEntry
} from '../../../src/shared/rpc-contract/bot-team-memory-params'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'

type HostClient = Pick<RpcClient, 'sendRequest'>

const REQUEST_TIMEOUT_MS = 15_000
const ListReply = z.object({ memory: z.array(BotTeamMemoryEntrySchema) })
const DeleteReply = z.object({ deleted: z.boolean() })

export type MobileBotTeamMemoryResult =
  | { kind: 'ready'; memory: BotTeamMemoryEntry[] }
  /** A host from before team memory: the screen says so rather than showing nothing. */
  | { kind: 'unsupported' }
  | { kind: 'failed' }

export async function listMobileBotTeamMemory(
  client: HostClient,
  teamId: string
): Promise<MobileBotTeamMemoryResult> {
  try {
    const response = await client.sendRequest(
      'botTeams.listMemory',
      { teamId },
      { timeoutMs: REQUEST_TIMEOUT_MS }
    )
    if (!response.ok) {
      return isMobileMethodUnavailableError(response.error.code, response.error.message)
        ? { kind: 'unsupported' }
        : { kind: 'failed' }
    }
    const parsed = ListReply.safeParse(response.result)
    return parsed.success ? { kind: 'ready', memory: parsed.data.memory } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

/** True when the host removed the line; a line is removed for good, with no undo. */
export async function deleteMobileBotTeamMemory(
  client: HostClient,
  memoryId: string
): Promise<boolean> {
  try {
    const response = await client.sendRequest(
      'botTeams.deleteMemory',
      { memoryId },
      { timeoutMs: REQUEST_TIMEOUT_MS }
    )
    if (!response.ok) {
      return false
    }
    const parsed = DeleteReply.safeParse(response.result)
    return parsed.success && parsed.data.deleted
  } catch {
    return false
  }
}
