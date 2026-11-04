import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BotRunDenial } from '../marketplace/marketplace-bot-run-denial'
import { readMcpServerTomlOwnership } from './config-toml-mcp-servers'

function tomlKeySegment(name: string): string {
  return /^[A-Za-z0-9_-]+$/.test(name) ? name : JSON.stringify(name)
}

/**
 * Root `-c` overrides that disable the denied MCP servers for one Codex app-server run. Only entries
 * the account's config.toml already holds are named: an override for an unknown server makes the
 * whole config fail to load ("invalid transport", codex-cli 0.159.2). A config that cannot be read,
 * or that owns `mcp_servers` as one inline table, yields none; the run then relies on its env alone.
 */
export async function codexBotRunMcpOverrideArgs(
  denial: BotRunDenial | null,
  codexHome: string | null,
  read: (path: string) => Promise<string> = (path) => readFile(path, 'utf8')
): Promise<string[]> {
  if (!denial || denial.mcpServers.length === 0 || !codexHome) {
    return []
  }
  let config: string
  try {
    config = await read(join(codexHome, 'config.toml'))
  } catch {
    return []
  }
  const { names, ownsRoot } = readMcpServerTomlOwnership(config)
  if (ownsRoot) {
    return []
  }
  return denial.mcpServers.flatMap((name) =>
    names.has(name) ? ['-c', `mcp_servers.${tomlKeySegment(name)}.enabled=false`] : []
  )
}
