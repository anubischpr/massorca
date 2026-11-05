import {
  MARKETPLACE_APP_AGENTS,
  isMarketplaceAppAllowedForBot,
  marketplaceAgentSupportsAppDenial,
  type MarketplaceAccessMode,
  type MarketplaceAgentAccess,
  type MarketplaceAppAccessPolicy,
  type MarketplaceAppAgent,
  type MarketplaceBotAccess
} from '../../../../shared/marketplace-apps'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'

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

/**
 * Lets a whole team use an app or keeps it out, editing only that team's picks. Under Everyone a
 * team kept out starts a fresh list, so dormant picks never deny a bot the user cannot see.
 */
export function withTeamAllowed(
  bots: MarketplaceBotAccess,
  team: BotTeam,
  allowed: boolean
): MarketplaceBotAccess {
  const withoutBots = (next: MarketplaceBotAccess): MarketplaceBotAccess =>
    team.bots.reduce((acc, member) => withBotPicked(acc, member.id, false), next)
  if (bots.mode === 'everyone') {
    return allowed ? bots : { mode: 'except', botIds: [], teamIds: [team.id] }
  }
  if (bots.mode === 'only') {
    return allowed
      ? withTeamPicked(bots, team.id, true)
      : withoutBots(withTeamPicked(bots, team.id, false))
  }
  return allowed
    ? withoutBots(withTeamPicked(bots, team.id, false))
    : withTeamPicked(bots, team.id, true)
}

/** True when the team may use the app: every bot in it may, or the team pick alone decides when it has none. */
export function marketplaceTeamAllowed(policy: MarketplaceAppAccessPolicy, team: BotTeam): boolean {
  if (team.bots.length === 0) {
    // Why: an empty team has no bot to ask about, so only its team pick is read; no bot id is ''.
    return isMarketplaceAppAllowedForBot(policy, { botId: '', teamId: team.id })
  }
  return team.bots.every((member) =>
    isMarketplaceAppAllowedForBot(policy, { botId: member.id, teamId: team.id })
  )
}

/**
 * Holds back a bot edit that would newly keep out a bot whose agent can't drop an app. Under Only
 * these such bots are picked back in; under All except the edit is refused (`bots` is null).
 */
export function withUnsupportedBotsKept(
  current: MarketplaceAppAccessPolicy,
  next: MarketplaceBotAccess,
  teams: readonly BotTeam[]
): { bots: MarketplaceBotAccess | null; heldBack: boolean } {
  const allowed = (bots: MarketplaceBotAccess, botId: string, teamId: string): boolean =>
    isMarketplaceAppAllowedForBot({ ...current, bots }, { botId, teamId })
  const held = teams.flatMap((team) =>
    team.bots
      .filter(
        (bot) =>
          !marketplaceAgentSupportsAppDenial(bot.agent) &&
          allowed(current.bots, bot.id, team.id) &&
          !allowed(next, bot.id, team.id)
      )
      .map((bot) => bot.id)
  )
  if (held.length === 0) {
    return { bots: next, heldBack: false }
  }
  if (next.mode === 'only') {
    return { bots: { ...next, botIds: [...next.botIds, ...held] }, heldBack: true }
  }
  return { bots: null, heldBack: true }
}
