import { homedir } from 'node:os'
import { antigravityNamesNoMcpServer } from '../antigravity/antigravity-configured-connectors'
import type { CommitMessageGenerationTarget } from '../text-generation/source-control-text-generation-types'

/**
 * Agents whose code mode depends on this host's own MCP config, not on their spec alone. Only
 * Antigravity: Codex's plugin and connector tools sit outside the `mcp_servers` overrides, so it has no
 * code mode (codex-cli 0.159.2 smoke).
 */
export type HostCheckedCodeReadAgent = 'antigravity'

const CACHE_MS = 60_000

type Probe = { at: number; allowed: boolean }
let probe: Probe | null = null
let probing = false

/**
 * The host-checked agents that may read code on this host, from a brief cache. A cold or stale entry
 * answers no and refreshes in the background, so the next question sees the result.
 */
export function codeReadHostAgents(): ReadonlySet<HostCheckedCodeReadAgent> {
  if (!probe || Date.now() - probe.at > CACHE_MS) {
    void refreshProbe()
  }
  return probe?.allowed ? new Set<HostCheckedCodeReadAgent>(['antigravity']) : new Set()
}

async function refreshProbe(): Promise<void> {
  if (probing) {
    return
  }
  probing = true
  try {
    probe = { at: Date.now(), allowed: await antigravityNamesNoMcpServer(homedir()) }
  } catch {
    probe = { at: Date.now(), allowed: false }
  } finally {
    probing = false
  }
}

/**
 * The MCP limits for one Antigravity code turn, read fresh from this host. Null when the turn cannot be
 * limited here (remote or WSL checkout, or an MCP server or unreadable MCP config is present), so the
 * turn is not planned as a code read.
 */
export async function resolveCodeReadHostArgs(args: {
  target: CommitMessageGenerationTarget
}): Promise<readonly string[] | null> {
  if (args.target.kind !== 'local' || args.target.wslDistro) {
    return null
  }
  return (await antigravityNamesNoMcpServer(homedir())) ? [] : null
}
