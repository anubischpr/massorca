import {
  MARKETPLACE_APP_AGENTS,
  MARKETPLACE_INTEGRATION_LEVELS,
  type MarketplaceAgentEntryState,
  type MarketplaceAppAgent,
  type MarketplaceAppAgentStatus,
  type MarketplaceAppId,
  type MarketplaceAppStatus,
  type MarketplaceIntegrationLevel
} from '../../shared/marketplace-apps'
import { mcpEntryState } from './agent-mcp-config'
import { readAgentEntryNames } from './marketplace-agent-config'
import type { MarketplaceAgentPaths } from './marketplace-agent-paths'
import {
  ENGRAM_ENTRY_NAME,
  GITHUB_ENTRY_NAME,
  OPENMETADATA_ENTRY_NAME
} from './marketplace-entry-specs'
import type { MarketplaceState, MarketplaceVault } from './marketplace-vault'

export type MarketplaceStatusDeps = {
  vault: MarketplaceVault
  paths: MarketplaceAgentPaths
  engramProgram: () => Promise<{ found: boolean; version: string | null }>
  githubAuthenticated: () => Promise<boolean>
}

const ENTRY_NAME: Record<MarketplaceAppId, string> = {
  engram: ENGRAM_ENTRY_NAME,
  openmetadata: OPENMETADATA_ENTRY_NAME,
  github: GITHUB_ENTRY_NAME
}

function levelFor(id: MarketplaceAppId, agent: MarketplaceAppAgent): MarketplaceIntegrationLevel {
  if (id === 'github') {
    return agent === 'claude' || agent === 'codex' ? 'full' : 'tools-only'
  }
  return MARKETPLACE_INTEGRATION_LEVELS[id][agent]
}

function agentStatuses(
  id: MarketplaceAppId,
  state: MarketplaceState,
  paths: MarketplaceAgentPaths
): MarketplaceAppAgentStatus[] {
  const name = ENTRY_NAME[id]
  return MARKETPLACE_APP_AGENTS.map((agent) => {
    const raw = mcpEntryState(readAgentEntryNames(agent, paths.mcpConfig(agent)), name)
    const writtenByUs = id !== 'github' && state.written[id][agent]?.entries.includes(name) === true
    // Why: Gentle Shell ships some apps itself; an entry MassOrca did not write there is its own.
    const entry: MarketplaceAgentEntryState =
      raw === 'set' && agent === 'gentle-shell' && !writtenByUs ? 'built-in' : raw
    return { agent, level: levelFor(id, agent), entry }
  })
}

function usable(agents: readonly MarketplaceAppAgentStatus[]): boolean {
  return agents.some((agent) => agent.entry === 'set' || agent.entry === 'built-in')
}

/** Status of every app on this computer; reads entry names and file presence, never a token. */
export async function readAppStatuses(
  deps: MarketplaceStatusDeps
): Promise<MarketplaceAppStatus[]> {
  const { vault, paths } = deps
  const state = vault.readState()
  const [program, githubConnected] = await Promise.all([
    deps.engramProgram(),
    deps.githubAuthenticated()
  ])
  const engramAgents = agentStatuses('engram', state, paths)
  const openMetadataAgents = agentStatuses('openmetadata', state, paths)
  const openMetadata = vault.credentialStatus({ kind: 'openmetadata' })
  return [
    {
      id: 'engram',
      connected: program.found && usable(engramAgents),
      program,
      credential: vault.credentialStatus({ kind: 'engram-cloud' }),
      serverUrl: state.engram.serverUrl,
      agents: engramAgents
    },
    {
      id: 'openmetadata',
      connected: openMetadata.stored && usable(openMetadataAgents),
      credential: openMetadata,
      serverUrl: state.openMetadata.url,
      profiles: state.openMetadata.profiles.map((profile) => ({
        name: profile.name,
        url: profile.url,
        hasToken: vault.hasToken({ kind: 'openmetadata-profile', name: profile.name })
      })),
      agents: openMetadataAgents
    },
    {
      id: 'github',
      connected: githubConnected && !state.github.hidden,
      agents: agentStatuses('github', state, paths)
    }
  ]
}
