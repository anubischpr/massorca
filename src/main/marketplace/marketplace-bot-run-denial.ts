import {
  ENGRAM_CLOUD_SERVER_ENV,
  MARKETPLACE_APP_IDS,
  ENGRAM_CLOUD_TOKEN_ENV,
  OPENMETADATA_TOKEN_ENV,
  marketplaceAppMcpServerNames,
  marketplaceAppTokenEnvNames,
  marketplaceAppsDeniedForBot,
  type MarketplaceAppId,
  type MarketplaceAppStatus
} from '../../shared/marketplace-apps'
import { BOT_RUN_BOT_ID_OPTION, BOT_RUN_TEAM_ID_OPTION } from '../../shared/bot-run-session-options'
import { getMarketplaceVault } from './marketplace-vault'

export { BOT_RUN_BOT_ID_OPTION, BOT_RUN_TEAM_ID_OPTION }

export type BotRunDenialResolver = typeof resolveBotRunDenial

/** What a bot's run must not have: MCP server entries to leave out and env vars to delete. */
export type BotRunDenial = {
  mcpServers: readonly string[]
  envNames: readonly string[]
  /** Env var name prefixes; used only when the denied set cannot be read and every app is denied. */
  envPrefixes: readonly string[]
}

export function botRunOptions(bot: { botId: string; teamId: string }): Record<string, string> {
  return { [BOT_RUN_BOT_ID_OPTION]: bot.botId, [BOT_RUN_TEAM_ID_OPTION]: bot.teamId }
}

export function botRunOfOptions(
  options: Readonly<Record<string, string>> | undefined
): { botId: string; teamId: string } | null {
  const botId = options?.[BOT_RUN_BOT_ID_OPTION]
  const teamId = options?.[BOT_RUN_TEAM_ID_OPTION]
  return botId && teamId ? { botId, teamId } : null
}

/** Used when the app list cannot be read: a bot run then gets none of the Marketplace apps. */
const DENY_EVERY_APP: BotRunDenial = {
  mcpServers: ['engram', 'openmetadata'],
  envNames: [ENGRAM_CLOUD_TOKEN_ENV, ENGRAM_CLOUD_SERVER_ENV, OPENMETADATA_TOKEN_ENV],
  envPrefixes: [`${OPENMETADATA_TOKEN_ENV}_`]
}

/**
 * Every app with its stored policy, counted as connected: token injection reads the vault without
 * checking whether an app is connected, so the denial must not depend on it either.
 */
async function listAppsByStoredPolicy(): Promise<MarketplaceAppStatus[]> {
  const state = getMarketplaceVault().readStateForDenial()
  const profiles = state.openMetadata.profiles.map((profile) => ({ ...profile, hasToken: true }))
  return MARKETPLACE_APP_IDS.map((id) => ({
    id,
    connected: true,
    agents: [],
    access: state.access[id],
    ...(id === 'openmetadata' ? { profiles } : {})
  }))
}

/**
 * The Marketplace apps a session's bot is kept out of; null for a session that is not a bot run or
 * a bot kept out of nothing. Never throws: an unreadable app list denies every app (fail closed).
 */
export async function resolveBotRunDenial(
  options: Readonly<Record<string, string>> | undefined,
  listApps: () => Promise<MarketplaceAppStatus[]> = listAppsByStoredPolicy
): Promise<BotRunDenial | null> {
  const bot = botRunOfOptions(options)
  if (!bot) {
    return null
  }
  let denied: MarketplaceAppStatus[]
  try {
    denied = marketplaceAppsDeniedForBot(await listApps(), bot)
  } catch {
    return DENY_EVERY_APP
  }
  if (denied.length === 0) {
    return null
  }
  return {
    mcpServers: [...new Set(denied.flatMap(marketplaceAppMcpServerNames))],
    envNames: [...new Set(denied.flatMap(marketplaceAppTokenEnvNames))],
    envPrefixes: []
  }
}

/** The ids of the connected apps a bot is kept out of, for prompts; an unreadable list denies every app. */
export async function deniedMarketplaceAppIdsForBot(
  bot: { botId: string; teamId: string },
  listApps: () => Promise<MarketplaceAppStatus[]> = listAppsByStoredPolicy
): Promise<MarketplaceAppId[]> {
  try {
    return marketplaceAppsDeniedForBot(await listApps(), bot).map((app) => app.id)
  } catch {
    return [...MARKETPLACE_APP_IDS]
  }
}

/** Deletes the denied apps' env vars from a child env in place; the same env is returned. */
export function deleteBotRunDeniedEnv<T extends Record<string, string | undefined>>(
  env: T,
  denial: BotRunDenial | null
): T {
  return denial ? deleteEnvKeys(env, denial.envNames, denial.envPrefixes) : env
}

/** Deletes env vars by name or prefix in place, ignoring case (Windows names are case-blind). */
export function deleteEnvKeys<T extends Record<string, string | undefined>>(
  env: T,
  names: readonly string[],
  prefixes: readonly string[] = []
): T {
  const upperNames = names.map((name) => name.toUpperCase())
  const upperPrefixes = prefixes.map((prefix) => prefix.toUpperCase())
  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase()
    if (upperNames.includes(upper) || upperPrefixes.some((prefix) => upper.startsWith(prefix))) {
      delete env[key]
    }
  }
  return env
}

/**
 * A provider child's env from a host environment (undefined entries dropped) without the apps a bot
 * run is kept out of; `envToDelete` also strips them from what the child inherits from Orca.
 */
export async function botRunChildEnv(
  environment: NodeJS.ProcessEnv,
  options: Readonly<Record<string, string>> | undefined,
  resolve: BotRunDenialResolver = resolveBotRunDenial
): Promise<{ env: Record<string, string>; envToDelete?: string[] }> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(environment)) {
    if (value !== undefined) {
      env[key] = value
    }
  }
  const denial = await resolve(options)
  return denial
    ? { env: deleteBotRunDeniedEnv(env, denial), envToDelete: botRunEnvKeysToDelete(denial) }
    : { env }
}

/**
 * The env var names a spawn must delete from the env it inherits, names and prefixes expanded
 * against it ignoring case, since a spawn deletes exact keys and Windows names are case-blind.
 */
export function botRunEnvKeysToDelete(
  denial: BotRunDenial,
  inherited: Record<string, string | undefined> = process.env
): string[] {
  const kept = new Set(
    Object.keys(deleteEnvKeys({ ...inherited }, denial.envNames, denial.envPrefixes))
  )
  const inheritedDenied = Object.keys(inherited).filter((key) => !kept.has(key))
  return [...new Set([...denial.envNames, ...inheritedDenied])]
}

/** Claude deny rules that remove every tool of each denied MCP server from the model's tool list. */
export function claudeBotRunDisallowedTools(denial: BotRunDenial | null): string[] {
  // Why: Claude names a server's tools mcp__<server>__<tool> with other characters turned into `_`.
  return (denial?.mcpServers ?? []).map((name) => `mcp__${name.replace(/[^A-Za-z0-9_-]/g, '_')}`)
}
