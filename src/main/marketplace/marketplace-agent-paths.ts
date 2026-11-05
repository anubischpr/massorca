import { existsSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { MarketplaceAppAgent } from '../../shared/marketplace-apps'
import { createHomeMarketplaceAgentPaths } from './marketplace-home-agent-paths'

/** Where each agent keeps the files the Marketplace edits; injectable so tests stay in a temp folder. */
export type MarketplaceAgentPaths = {
  /** The home folder these paths belong to; a write that leaves it is refused. */
  home?: () => string
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

function realpathOfNearestAncestor(path: string): string {
  const tail: string[] = []
  let existing = path
  while (true) {
    try {
      return join(realpathSync(existing), ...tail)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      const parent = dirname(existing)
      if ((code !== 'ENOENT' && code !== 'ENOTDIR') || parent === existing) {
        return path
      }
      tail.unshift(basename(existing))
      existing = parent
    }
  }
}

function isInside(folder: string, path: string): boolean {
  const from = relative(folder, path)
  return from === '' || (from !== '..' && !from.startsWith(`..${sep}`) && !isAbsolute(from))
}

/**
 * Where a write to `path` really lands, following links so a dotfiles setup keeps its symlink.
 * Returns null when `home` is given and a link led out of it: that file belongs to someone else.
 * A path that is outside the home as written (such as a configured CLAUDE_CONFIG_DIR) is the
 * user's explicit choice and is kept.
 */
export function resolveWriteTarget(path: string, home: string | undefined): string | null {
  const target = realpathOfNearestAncestor(path)
  if (home === undefined || !isInside(resolve(home), resolve(path))) {
    return target
  }
  const realHome = realpathOfNearestAncestor(resolve(home))
  return isInside(realHome, target) || isInside(resolve(home), target) ? target : null
}
