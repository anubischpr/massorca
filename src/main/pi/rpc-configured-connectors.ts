import { open } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentSessionConnectorSnapshot } from '../../shared/agent-session-connectors'
import { readAgentSessionConnectorSnapshot } from '../../shared/agent-session-connectors'

const MAX_CONFIG_BYTES = 1024 * 1024

async function readBoundedText(file: string): Promise<string | undefined> {
  let handle
  try {
    handle = await open(file, 'r')
  } catch {
    return undefined
  }
  try {
    const { size } = await handle.stat()
    return size <= MAX_CONFIG_BYTES ? await handle.readFile('utf8') : undefined
  } catch {
    return undefined
  } finally {
    await handle.close().catch(() => {})
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Servers named in the session's `<agent dir>/mcp.json`. Pi reports no connection state over RPC,
 * so each row is `unknown` (or `disabled` where the file says so), never `connected`; only names
 * leave this file, never commands, URLs, headers or environment.
 */
export async function readPiConfiguredConnectors(
  agentDir: string
): Promise<AgentSessionConnectorSnapshot | undefined> {
  const text = await readBoundedText(join(agentDir, 'mcp.json'))
  if (text === undefined) {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  const table = isRecord(parsed) ? (parsed.mcpServers ?? parsed.servers) : undefined
  if (!isRecord(table)) {
    return undefined
  }
  const servers = Object.entries(table).flatMap(([name, config]) =>
    name.trim() && name.length <= 512
      ? [
          {
            name,
            status:
              isRecord(config) && (config.disabled === true || config.enabled === false)
                ? ('disabled' as const)
                : ('unknown' as const),
            configured: true as const
          }
        ]
      : []
  )
  return servers.length > 0
    ? readAgentSessionConnectorSnapshot({ observedAt: Date.now(), servers: servers.slice(0, 1000) })
    : undefined
}
