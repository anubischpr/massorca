import type { BotTeamSessionTeamsResult } from '../../../shared/rpc-contract/bot-team-session-team-params'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { callRuntimeRpc } from './runtime-rpc-client'

/**
 * Bot-team sessions on the current host. A host from before this method has no such
 * route, so its sessions simply carry no character.
 */
let inFlight: Promise<BotTeamSessionTeamsResult['sessionTeams']> | null = null

/** Every worktree card asks at once on one refresh; they share the one request in flight. */
export function listBotTeamSessionTeams(): Promise<BotTeamSessionTeamsResult['sessionTeams']> {
  inFlight ??= fetchBotTeamSessionTeams().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function fetchBotTeamSessionTeams(): Promise<BotTeamSessionTeamsResult['sessionTeams']> {
  try {
    const result = await callRuntimeRpc<BotTeamSessionTeamsResult>(
      botTeamHostTarget(currentBotTeamHost()),
      'botTeams.sessionTeams',
      null
    )
    return result.sessionTeams
  } catch {
    return {}
  }
}
