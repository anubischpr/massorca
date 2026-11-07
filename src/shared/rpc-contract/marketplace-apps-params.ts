import { z } from 'zod'
import {
  MARKETPLACE_APP_AGENTS,
  MARKETPLACE_APP_IDS,
  type MarketplaceActionResult,
  type MarketplaceAppsListResult
} from '../marketplace-apps'
import { accessPolicyInputSchema } from '../marketplace/marketplace-access-input-schema'

export const MARKETPLACE_APPS_LIST_METHOD = 'marketplace.apps.list'
export const MARKETPLACE_APPS_CONNECT_METHOD = 'marketplace.apps.connect'
export const MARKETPLACE_APPS_DISCONNECT_METHOD = 'marketplace.apps.disconnect'
export const MARKETPLACE_APPS_SET_OPENMETADATA_TOKEN_METHOD =
  'marketplace.apps.setOpenMetadataToken'
export const MARKETPLACE_APPS_ADD_OPENMETADATA_PROFILE_METHOD =
  'marketplace.apps.addOpenMetadataProfile'
export const MARKETPLACE_APPS_REMOVE_OPENMETADATA_PROFILE_METHOD =
  'marketplace.apps.removeOpenMetadataProfile'
export const MARKETPLACE_APPS_SET_ENGRAM_SERVER_METHOD = 'marketplace.apps.setEngramServer'
export const MARKETPLACE_APPS_SET_ACCESS_POLICY_METHOD = 'marketplace.apps.setAccessPolicy'

const MAX_URL_LENGTH = 2048
const MAX_TOKEN_LENGTH = 8192
const MAX_PROFILE_NAME_LENGTH = 40

// Why: these only bound the shape; the host's service re-checks every value and answers `invalid-input`.
const Url = z.string().min(1).max(MAX_URL_LENGTH)
const Token = z.string().min(1).max(MAX_TOKEN_LENGTH)
const ProfileName = z.string().min(1).max(MAX_PROFILE_NAME_LENGTH)

/** A token travels renderer to host once; no result or log ever carries it back. */
export const MarketplaceAppsConnect = z.discriminatedUnion('id', [
  z.object({ id: z.literal('engram') }),
  z.object({ id: z.literal('github') }),
  z.object({ id: z.literal('openmetadata'), url: Url, token: Token })
])

export const MarketplaceAppsDisconnect = z.object({ id: z.enum(MARKETPLACE_APP_IDS) })
export const MarketplaceAppsSetOpenMetadataToken = z.object({ token: Token })
export const MarketplaceAppsAddOpenMetadataProfile = z.object({
  name: ProfileName,
  url: Url,
  token: Token
})
export const MarketplaceAppsRemoveOpenMetadataProfile = z.object({ name: ProfileName })
export const MarketplaceAppsSetEngramServer = z.object({
  url: Url.nullable(),
  token: Token.optional()
})
export const MarketplaceAppsSetAccessPolicy = z.object({
  id: z.enum(MARKETPLACE_APP_IDS),
  policy: accessPolicyInputSchema
})

const AgentStatusSchema = z.object({
  agent: z.enum(MARKETPLACE_APP_AGENTS),
  level: z.enum(['full', 'tools-only', 'built-in']),
  entry: z.enum(['set', 'missing', 'unreadable', 'built-in']),
  allowed: z.boolean().optional(),
  // Why: without it a client never sees a "Missing" entry on a picked host, so Connect is not offered.
  installed: z.boolean().optional().catch(undefined),
  // Why: an optional flag, not an entry value: an older peer's strict entry enum would reject the whole list.
  outsideHome: z.boolean().optional().catch(undefined),
  // Why: without it a remote host's agent can never read as missing its entry.
  installed: z.boolean().optional().catch(undefined)
})

const CredentialSchema = z.object({
  stored: z.boolean(),
  updatedAt: z.number().int().nonnegative().optional(),
  location: z
    .object({ hostLabel: z.string().max(255), store: z.enum(['keychain', 'key-file']) })
    .optional()
})

/**
 * What a host answers with. A client rebuilds its result from these fields only, so nothing a
 * host adds later (or a token it should never send) can reach the page.
 */
export const MarketplaceAppStatusSchema = z.object({
  id: z.enum(MARKETPLACE_APP_IDS),
  connected: z.boolean(),
  program: z.object({ found: z.boolean(), version: z.string().max(200).nullable() }).optional(),
  credential: CredentialSchema.optional(),
  serverUrl: z.string().max(MAX_URL_LENGTH).nullable().optional(),
  profiles: z
    .array(
      z.object({
        name: z.string().max(MAX_PROFILE_NAME_LENGTH),
        url: z.string().max(MAX_URL_LENGTH),
        hasToken: z.boolean()
      })
    )
    .max(200)
    .optional(),
  agents: z.array(AgentStatusSchema).max(16),
  access: accessPolicyInputSchema.optional()
})

export const MarketplaceAppsListAnswerSchema = z.object({
  ok: z.literal(true),
  apps: z.array(MarketplaceAppStatusSchema).max(16)
})

const ActionFailureSchema = z.object({
  ok: z.literal(false),
  reason: z.enum([
    'invalid-input',
    'unreadable-config',
    'unsupported-shape',
    'outside-home',
    'vault-unavailable',
    'failed'
  ]),
  agent: z.enum(MARKETPLACE_APP_AGENTS).optional()
})

export const MarketplaceActionAnswerSchema = z.union([
  z.object({ ok: z.literal(true), status: MarketplaceAppStatusSchema }),
  ActionFailureSchema
])

/** Rebuilds a list answer from the known fields; anything else reads as a failed call. */
export function readMarketplaceAppsListAnswer(answer: unknown): MarketplaceAppsListResult {
  const parsed = MarketplaceAppsListAnswerSchema.safeParse(answer)
  return parsed.success ? { ok: true, apps: parsed.data.apps } : { ok: false, reason: 'failed' }
}

/** Rebuilds an action answer from the known fields; anything else reads as a failed call. */
export function readMarketplaceActionAnswer(answer: unknown): MarketplaceActionResult {
  const parsed = MarketplaceActionAnswerSchema.safeParse(answer)
  if (!parsed.success) {
    return { ok: false, reason: 'failed' }
  }
  const data = parsed.data
  if (data.ok) {
    return { ok: true, status: data.status }
  }
  return data.agent
    ? { ok: false, reason: data.reason, agent: data.agent }
    : { ok: false, reason: data.reason }
}

/** Method name to the `MarketplaceAppsApi` call it carries, for every client that addresses a host. */
export const MARKETPLACE_APPS_HOST_METHODS = {
  listApps: MARKETPLACE_APPS_LIST_METHOD,
  connect: MARKETPLACE_APPS_CONNECT_METHOD,
  disconnect: MARKETPLACE_APPS_DISCONNECT_METHOD,
  setOpenMetadataToken: MARKETPLACE_APPS_SET_OPENMETADATA_TOKEN_METHOD,
  addOpenMetadataProfile: MARKETPLACE_APPS_ADD_OPENMETADATA_PROFILE_METHOD,
  removeOpenMetadataProfile: MARKETPLACE_APPS_REMOVE_OPENMETADATA_PROFILE_METHOD,
  setEngramServer: MARKETPLACE_APPS_SET_ENGRAM_SERVER_METHOD,
  setAccessPolicy: MARKETPLACE_APPS_SET_ACCESS_POLICY_METHOD
} as const

export type MarketplaceAppsHostCall = keyof typeof MARKETPLACE_APPS_HOST_METHODS
