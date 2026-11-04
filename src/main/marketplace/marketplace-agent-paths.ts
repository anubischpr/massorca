import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { MarketplaceAppAgent } from '../../shared/marketplace-apps'
import { ClaudeRuntimePathResolver } from '../claude-accounts/runtime-paths'
import { getSystemCodexHomePath } from '../codex/codex-home-paths'
import { gentleShellAgentDir } from './gentle-shell-agent-dir'

/** Where each agent keeps the files the Marketplace edits; injectable so tests stay in a temp folder. */
export type MarketplaceAgentPaths = {
  mcpConfig: (agent: MarketplaceAppAgent) => string
  /** The user-level instructions file, for agents that read one. */
  instructions: (agent: MarketplaceAppAgent) => string | null
  /** The agent's home folder; MassOrca writes only when it (or the MCP config) already exists. */
  presenceDir: (agent: MarketplaceAppAgent) => string | null
}

export const defaultMarketplaceAgentPaths: MarketplaceAgentPaths = {
  mcpConfig: (agent) => {
    switch (agent) {
      case 'claude':
        return new ClaudeRuntimePathResolver().getRuntimePaths().configPath
      case 'codex':
        return join(getSystemCodexHomePath(), 'config.toml')
      case 'antigravity':
        return join(homedir(), '.gemini', 'config', 'mcp_config.json')
      case 'gentle-shell':
        return join(gentleShellAgentDir(), 'mcp.json')
    }
  },
  instructions: (agent) => {
    switch (agent) {
      case 'claude':
        return join(new ClaudeRuntimePathResolver().getRuntimePaths().configDir, 'CLAUDE.md')
      case 'codex':
        return join(getSystemCodexHomePath(), 'AGENTS.md')
      case 'antigravity':
      case 'gentle-shell':
        return null
    }
  },
  presenceDir: (agent) => {
    switch (agent) {
      case 'claude':
        return new ClaudeRuntimePathResolver().getRuntimePaths().configDir
      case 'codex':
        return getSystemCodexHomePath()
      case 'antigravity':
        return join(homedir(), '.gemini')
      case 'gentle-shell':
        return gentleShellAgentDir()
    }
  }
}

/** Why: MassOrca never creates the home of an agent that is not on this computer. */
export function isAgentPresent(agent: MarketplaceAppAgent, paths: MarketplaceAgentPaths): boolean {
  const presence = paths.presenceDir(agent)
  return presence === null || existsSync(presence) || existsSync(paths.mcpConfig(agent))
}
