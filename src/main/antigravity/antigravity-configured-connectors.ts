import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  readAgentSessionConnectorSnapshot,
  type AgentSessionConnectorSnapshot
} from '../../shared/agent-session-connectors'
import {
  isJsonRecord,
  readAntigravityDisabledPlugins,
  readAntigravityJsonFile,
  readAntigravityPluginDirectories
} from './antigravity-config-files'

type Connector = AgentSessionConnectorSnapshot['servers'][number]
type ServerEntry = { name: string; disabled: boolean }

const MAX_CONNECTORS = 1000
const MAX_NAME_LENGTH = 512

/** The MCP servers agy loads for `home`: the global mcp_config.json, then each plugin under
 *  config/plugins that has a plugin.json and is not switched off in config.json. Plugin servers are
 *  named `<plugin>_<server>`. Only names and state leave these files; never commands, URLs or env. */
export async function readAntigravityConfiguredConnectors(
  home: string
): Promise<AgentSessionConnectorSnapshot | undefined> {
  const configDir = join(home, '.gemini', 'config')
  const disabledPlugins = await readAntigravityDisabledPlugins(join(configDir, 'config.json'))
  const globalServers = (await readServerTable(join(configDir, 'mcp_config.json'))).flatMap(
    (entry) => connectorRow(entry.name, entry.disabled)
  )
  const pluginServers = await readPluginConnectors(join(configDir, 'plugins'), disabledPlugins)
  const servers = uniqueByName([...globalServers, ...pluginServers]).slice(0, MAX_CONNECTORS)
  return servers.length > 0
    ? readAgentSessionConnectorSnapshot({ observedAt: Date.now(), servers })
    : undefined
}

/** True only when every MCP config agy could read names no server; a config that exists but cannot be
 *  read answers false, since its servers are unknown. */
export async function antigravityNamesNoMcpServer(home: string): Promise<boolean> {
  const configDir = join(home, '.gemini', 'config')
  const pluginsDir = join(configDir, 'plugins')
  const plugins = await readdir(pluginsDir, { withFileTypes: true }).catch(() => [])
  const files = [
    join(configDir, 'mcp_config.json'),
    ...plugins
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(pluginsDir, entry.name, 'mcp_config.json'))
  ]
  const states = await Promise.all(files.map(readMcpConfigState))
  return states.every((state) => state === 'none')
}

async function readMcpConfigState(file: string): Promise<'none' | 'servers' | 'unknown'> {
  const exists = await stat(file).then(
    () => true,
    (error: NodeJS.ErrnoException) => (error.code === 'ENOENT' ? false : undefined)
  )
  if (exists === false) {
    return 'none'
  }
  const read = await readAntigravityJsonFile(file, { allowBom: false })
  if (!read) {
    return 'unknown'
  }
  const servers = isJsonRecord(read.value) ? read.value.mcpServers : undefined
  return isJsonRecord(servers) && Object.keys(servers).length > 0 ? 'servers' : 'none'
}

async function readPluginConnectors(
  pluginsDir: string,
  disabledPlugins: ReadonlySet<string>
): Promise<Connector[]> {
  const plugins = await readAntigravityPluginDirectories(pluginsDir)
  const rows = await Promise.all(
    plugins.map(async (plugin) =>
      (await readServerTable(join(pluginsDir, plugin, 'mcp_config.json'))).flatMap((entry) =>
        connectorRow(`${plugin}_${entry.name}`, disabledPlugins.has(plugin) || entry.disabled)
      )
    )
  )
  return rows.flat()
}

/** agy reads mcpServers only from a strict-JSON file whose field is an object; a non-object entry is
 *  skipped on its own. */
async function readServerTable(file: string): Promise<ServerEntry[]> {
  const read = await readAntigravityJsonFile(file, { allowBom: false })
  if (!read || !isJsonRecord(read.value) || !isJsonRecord(read.value.mcpServers)) {
    return []
  }
  return Object.entries(read.value.mcpServers).flatMap(([name, config]) =>
    isJsonRecord(config) ? [{ name, disabled: config.disabled === true }] : []
  )
}

function connectorRow(name: string, disabled: boolean): Connector[] {
  return name.trim() && name.length <= MAX_NAME_LENGTH
    ? [{ name, status: disabled ? 'disabled' : 'unknown', configured: true }]
    : []
}

function uniqueByName(rows: readonly Connector[]): Connector[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    if (seen.has(row.name)) {
      return false
    }
    seen.add(row.name)
    return true
  })
}
