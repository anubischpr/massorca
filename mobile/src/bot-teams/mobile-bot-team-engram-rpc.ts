import {
  BotTeamEngramReplySchema,
  type BotTeamEngramReply
} from '../../../src/shared/rpc-contract/bot-team-engram-params'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'

type HostClient = Pick<RpcClient, 'sendRequest'>

// Above the host's own 10 s limit on the Engram CLI.
const REQUEST_TIMEOUT_MS = 15_000

/** A host from before this method, or one that cannot be reached, never throws: it reads as a status. */
export async function listMobileBotTeamEngramMemory(
  client: HostClient,
  input: { teamId: string; projectId: string; query?: string }
): Promise<BotTeamEngramReply> {
  try {
    const response = await client.sendRequest('botTeams.listEngramMemory', input, {
      timeoutMs: REQUEST_TIMEOUT_MS
    })
    if (!response.ok) {
      return {
        status: isMobileMethodUnavailableError(response.error.code, response.error.message)
          ? 'unavailable'
          : 'failed',
        memories: []
      }
    }
    const parsed = BotTeamEngramReplySchema.safeParse(response.result)
    return parsed.success ? parsed.data : { status: 'failed', memories: [] }
  } catch {
    return { status: 'failed', memories: [] }
  }
}
