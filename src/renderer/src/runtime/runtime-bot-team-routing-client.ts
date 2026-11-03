import type { BotTeamTask } from '../../../shared/rpc-contract/bot-team-room-params'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { callRuntimeRpc } from './runtime-rpc-client'

// Same host as every other Bot teams call; see `resolveBotTeamHost` for which.
function call<TResult>(method: string, params?: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
}

/** Gives an idle task to a bot of any team; the new owner starts it fresh, with the task so far. */
export function reassignBotTeamTask(
  taskId: string,
  botId: string
): Promise<{ task: BotTeamTask; startError: string | null }> {
  return call('botTeams.reassignTask', { taskId, botId })
}
