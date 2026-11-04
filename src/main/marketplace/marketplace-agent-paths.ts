import { existsSync } from 'node:fs'
import type { MarketplaceAppAgent } from '../../shared/marketplace-apps'
import { createHomeMarketplaceAgentPaths } from './marketplace-home-agent-paths'

/** Where each agent keeps the files the Marketplace edits; injectable so tests stay in a temp folder. */
export type MarketplaceAgentPaths = {
  mcpConfig: (agent: MarketplaceAppAgent) => string
  /** The user-level instructions file, for agents that read one. */
  instructions: (agent: MarketplaceAppAgent) => string | null
  /** The agent's home folder; MassOrca writes only when it (or the MCP config) already exists. */
  presenceDir: (agent: MarketplaceAppAgent) => string | null
}

/** This computer's paths; an SSH host builds the same ones from its own home folder. */
export const defaultMarketplaceAgentPaths: MarketplaceAgentPaths = createHomeMarketplaceAgentPaths()

/** Why: MassOrca never creates the home of an agent that is not on this computer. */
export function isAgentPresent(agent: MarketplaceAppAgent, paths: MarketplaceAgentPaths): boolean {
  const presence = paths.presenceDir(agent)
  return presence === null || existsSync(presence) || existsSync(paths.mcpConfig(agent))
}
