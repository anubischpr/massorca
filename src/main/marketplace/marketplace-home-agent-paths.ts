import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { MarketplaceAppAgent } from '../../shared/marketplace-apps'
import { gentleShellAgentDir } from './gentle-shell-agent-dir'
import type { MarketplaceAgentPaths } from './marketplace-agent-paths'

type HomeAgentPathsOptions = {
  /** The home folder of the user whose agents are edited; read on every call by default. */
  home?: () => string
  env?: () => Readonly<Record<string, string | undefined>>
}

/**
 * Where each agent keeps its files for one user on a host with no Electron: a plain Node process
 * on an SSH host. It follows the same rules as this computer's paths (`CLAUDE_CONFIG_DIR`,
 * `~/.claude.json`, `~/.codex`, `PI_CODING_AGENT_DIR`), so both write the same files.
 */
export function createHomeMarketplaceAgentPaths(
  options: HomeAgentPathsOptions = {}
): MarketplaceAgentPaths {
  const home = options.home ?? homedir
  const env = options.env ?? ((): Readonly<Record<string, string | undefined>> => process.env)

  const claude = (): { configDir: string; configPath: string } => {
    const inherited = env().CLAUDE_CONFIG_DIR?.trim() || null
    const configDir = inherited || join(home(), '.claude')
    const colocated = join(configDir, '.claude.json')
    return {
      configDir,
      configPath: inherited || existsSync(colocated) ? colocated : join(home(), '.claude.json')
    }
  }

  return {
    home: () => home(),
    mcpConfig: (agent: MarketplaceAppAgent) => {
      switch (agent) {
        case 'claude':
          return claude().configPath
        case 'codex':
          return join(home(), '.codex', 'config.toml')
        case 'antigravity':
          return join(home(), '.gemini', 'config', 'mcp_config.json')
        case 'gentle-shell':
          return join(gentleShellAgentDir(env(), home()), 'mcp.json')
      }
    },
    instructions: (agent) => {
      switch (agent) {
        case 'claude':
          return join(claude().configDir, 'CLAUDE.md')
        case 'codex':
          return join(home(), '.codex', 'AGENTS.md')
        case 'antigravity':
        case 'gentle-shell':
          return null
      }
    },
    presenceDir: (agent) => {
      switch (agent) {
        case 'claude':
          return claude().configDir
        case 'codex':
          return join(home(), '.codex')
        case 'antigravity':
          return join(home(), '.gemini')
        case 'gentle-shell':
          return gentleShellAgentDir(env(), home())
      }
    }
  }
}
