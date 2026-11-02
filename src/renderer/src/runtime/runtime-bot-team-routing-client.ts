import type { BotTeamTask } from '../../../shared/rpc-contract/bot-team-room-params'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { callRuntimeRpc } from './runtime-rpc-client'

// Same host as every other Bot teams call; see `resolveBotTeamHost` for which.
function call<TResult>(method: string, params?: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
}

/** Files a request the room asked about: with a bot, and in another team when `toTeamId` is set. */
export function assignBotTeamRequest(input: {
  teamId: string
  text: string
  botId?: string
  toTeamId?: string
  start: boolean
}): Promise<{ task: BotTeamTask; startError: string | null }> {
  return call('botTeams.assignRequest', input)
}
