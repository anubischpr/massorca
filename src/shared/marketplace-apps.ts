/** Agents the Marketplace wires apps into on this computer. Gentle Shell is never called Pi in the UI. */
export const MARKETPLACE_APP_AGENTS = ['claude', 'codex', 'antigravity', 'gentle-shell'] as const
export type MarketplaceAppAgent = (typeof MARKETPLACE_APP_AGENTS)[number]

export const MARKETPLACE_APP_IDS = ['engram', 'openmetadata', 'github'] as const
export type MarketplaceAppId = (typeof MARKETPLACE_APP_IDS)[number]

/** Full: MCP plus hooks or instructions, used by itself. Tools only: MCP, used when asked. Built in: the agent brings it. */
export type MarketplaceIntegrationLevel = 'full' | 'tools-only' | 'built-in'

/** Whether an app's MCP entry is in one agent's own config. Entry names only, never values. */
export type MarketplaceAgentEntryState = 'set' | 'missing' | 'unreadable' | 'built-in'

export type MarketplaceAppAgentStatus = {
  agent: MarketplaceAppAgent
  level: MarketplaceIntegrationLevel
  entry: MarketplaceAgentEntryState
}

/** A profile that already exists on the OpenMetadata server; MassOrca never creates or edits it there. */
export type OpenMetadataProfile = { name: string; url: string; hasToken: boolean }

export type MarketplaceAppStatus = {
  id: MarketplaceAppId
  /** Connected means usable by agents on this computer. */
  connected: boolean
  /** Installed program, for tools such as Engram. */
  program?: { found: boolean; version: string | null }
  /** Whether the app's credential is in the vault; never the value. */
  credential?: { stored: boolean }
  /** OpenMetadata server address or the user's own Engram server. */
  serverUrl?: string | null
  profiles?: OpenMetadataProfile[]
  agents: MarketplaceAppAgentStatus[]
}

export type MarketplaceConnectArgs =
  | { id: 'engram' }
  /** Shows GitHub to agents again after a Disconnect; accounts stay in gh. */
  | { id: 'github' }
  | { id: 'openmetadata'; url: string; token: string }

export type MarketplaceActionResult =
  | { ok: true; status: MarketplaceAppStatus }
  | {
      ok: false
      reason:
        | 'invalid-input'
        | 'unreadable-config'
        | 'unsupported-shape'
        | 'vault-unavailable'
        | 'failed'
      /** Which agent's config caused the failure, when one did. */
      agent?: MarketplaceAppAgent
    }

export type MarketplaceAppsApi = {
  /** Installed and connectable apps with their state on this computer; also feeds the @ menu. */
  listApps: () => Promise<MarketplaceAppStatus[]>
  connect: (args: MarketplaceConnectArgs) => Promise<MarketplaceActionResult>
  /** Removes the app's entries from every agent MassOrca wrote to and deletes its stored credentials. */
  disconnect: (args: { id: MarketplaceAppId }) => Promise<MarketplaceActionResult>
  setOpenMetadataToken: (args: { token: string }) => Promise<MarketplaceActionResult>
  addOpenMetadataProfile: (args: {
    name: string
    url: string
    token: string
  }) => Promise<MarketplaceActionResult>
  removeOpenMetadataProfile: (args: { name: string }) => Promise<MarketplaceActionResult>
  setEngramServer: (args: {
    url: string | null
    token?: string
  }) => Promise<MarketplaceActionResult>
}

/** Env vars MassOrca adds to agents it launches; agent configs only name them. */
export const OPENMETADATA_TOKEN_ENV = 'OPENMETADATA_TOKEN'
export const ENGRAM_CLOUD_TOKEN_ENV = 'ENGRAM_CLOUD_TOKEN'
export const ENGRAM_CLOUD_SERVER_ENV = 'ENGRAM_CLOUD_SERVER'
/** Per-profile token var: OPENMETADATA_TOKEN_<NAME>, NAME upper-cased with non-alphanumerics as `_`. */
export function openMetadataProfileTokenEnv(name: string): string {
  return `${OPENMETADATA_TOKEN_ENV}_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
}

/** Levels per app: full needs MCP plus hooks or instructions MassOrca knows how to write. */
export const MARKETPLACE_INTEGRATION_LEVELS: Record<
  Exclude<MarketplaceAppId, 'github'>,
  Record<MarketplaceAppAgent, MarketplaceIntegrationLevel>
> = {
  engram: {
    claude: 'full',
    codex: 'full',
    antigravity: 'tools-only',
    'gentle-shell': 'tools-only'
  },
  openmetadata: {
    claude: 'full',
    codex: 'full',
    antigravity: 'tools-only',
    'gentle-shell': 'tools-only'
  }
}
