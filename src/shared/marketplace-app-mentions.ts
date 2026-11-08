import {
  MARKETPLACE_APP_IDS,
  isMarketplaceAppAllowedForBot,
  type MarketplaceAppId,
  type MarketplaceAppStatus
} from './marketplace-apps'

/** The name an installed app goes by in an @ menu, its chip and the message text. */
export const MARKETPLACE_APP_NAMES: Record<MarketplaceAppId, string> = {
  engram: 'Engram',
  openmetadata: 'OpenMetadata',
  github: 'GitHub'
}

/** An installed Marketplace app an @ menu can name. */
export type MarketplaceAppMention = { id: MarketplaceAppId; name: string }

export function marketplaceAppMention(id: MarketplaceAppId): MarketplaceAppMention {
  return { id, name: MARKETPLACE_APP_NAMES[id] }
}

/** The apps a message names as `@Name`, once each, in catalog order. */
export function mentionedMarketplaceApps(text: string): MarketplaceAppId[] {
  return MARKETPLACE_APP_IDS.filter((id) =>
    // Why: the lookbehind keeps a mid-word @ (an address) out; the lookahead keeps "@GitHubber" out.
    new RegExp(`(?<![\\p{L}\\p{N}_@])@${MARKETPLACE_APP_NAMES[id]}(?![\\p{L}\\p{N}_])`, 'iu').test(
      text
    )
  )
}

/**
 * One line per mentioned app telling the agent to use it; GitHub reaches agents through gh, not MCP.
 * An app the target bot is kept out of gets no line.
 */
export function marketplaceAppPromptLines(
  ids: readonly MarketplaceAppId[],
  deniedIds: readonly MarketplaceAppId[] = []
): string[] {
  return ids
    .filter((id) => !deniedIds.includes(id))
    .map((id) =>
      id === 'github'
        ? 'Use GitHub (the gh command) for this request.'
        : `Use the ${MARKETPLACE_APP_NAMES[id]} tools (MCP server ${id}) for this request.`
    )
}

/** The prompt with the lines for the apps its request names, or unchanged when it names none. */
export function withMarketplaceAppPromptLines(
  prompt: string,
  request: string,
  deniedIds: readonly MarketplaceAppId[] = []
): string {
  const lines = marketplaceAppPromptLines(mentionedMarketplaceApps(request), deniedIds)
  return lines.length > 0 ? [prompt, ...lines].join('\n\n') : prompt
}

/** A room's @ menu is team-wide, so an app stays unless every bot of the team is kept out of it. */
export function marketplaceAppsUsableByTeam<T extends Pick<MarketplaceAppStatus, 'id' | 'access'>>(
  apps: readonly T[],
  team: { id: string; bots: readonly { id: string }[] }
): T[] {
  return apps.filter(
    ({ access }) =>
      !access ||
      team.bots.length === 0 ||
      team.bots.some((bot) =>
        isMarketplaceAppAllowedForBot(access, { botId: bot.id, teamId: team.id })
      )
  )
}
