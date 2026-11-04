import {
  MARKETPLACE_APP_AGENTS,
  type MarketplaceAccessMode,
  type MarketplaceAgentAccess,
  type MarketplaceAppAgent,
  type MarketplaceBotAccess
} from '../../../../shared/marketplace-apps'

/** Pure edits of one access dimension; a change keeps the other dimension and its picks. */
export function withAgentMode(
  agents: MarketplaceAgentAccess,
  mode: MarketplaceAccessMode
): MarketplaceAgentAccess {
  return { ...agents, mode }
}

/** Agents come back in the catalog's order, so the saved list never depends on click order. */
export function withAgentPicked(
  agents: MarketplaceAgentAccess,
  agent: MarketplaceAppAgent,
  picked: boolean
): MarketplaceAgentAccess {
  const ids = MARKETPLACE_APP_AGENTS.filter((candidate) =>
    candidate === agent ? picked : agents.ids.includes(candidate)
  )
  return { ...agents, ids }
}

export function withBotMode(
  bots: MarketplaceBotAccess,
  mode: MarketplaceAccessMode
): MarketplaceBotAccess {
  return { ...bots, mode }
}

export function withBotPicked(
  bots: MarketplaceBotAccess,
  botId: string,
  picked: boolean
): MarketplaceBotAccess {
  return { ...bots, botIds: toggled(bots.botIds, botId, picked) }
}

export function withTeamPicked(
  bots: MarketplaceBotAccess,
  teamId: string,
  picked: boolean
): MarketplaceBotAccess {
  return { ...bots, teamIds: toggled(bots.teamIds, teamId, picked) }
}

function toggled(list: readonly string[], id: string, picked: boolean): string[] {
  const rest = list.filter((item) => item !== id)
  return picked ? [...rest, id] : rest
}
