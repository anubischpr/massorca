import type { BotTeamMemoryEntry } from '../../../shared/rpc-contract/bot-team-memory-params'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { callRuntimeRpc } from './runtime-rpc-client'
import { RuntimeRpcCallError } from './runtime-rpc-result'

// Same host as every other Bot teams call; see `resolveBotTeamHost` for which.
function call<TResult>(method: string, params?: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
}

/** A host from before team memory lacks the method: the answer is 'unavailable', not a failure. */
export async function listBotTeamMemory(
  teamId: string
): Promise<BotTeamMemoryEntry[] | 'unavailable'> {
  try {
    return (await call<{ memory: BotTeamMemoryEntry[] }>('botTeams.listMemory', { teamId })).memory
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}

/** Forgets one line for good: no bot reads it again. */
export async function deleteBotTeamMemory(memoryId: string): Promise<void> {
  await call('botTeams.deleteMemory', { memoryId })
}
