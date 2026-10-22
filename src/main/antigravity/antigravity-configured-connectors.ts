import { open, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  readAgentSessionConnectorSnapshot,
  type AgentSessionConnectorSnapshot
} from '../../shared/agent-session-connectors'

type Connector = AgentSessionConnectorSnapshot['servers'][number]
type ServerEntry = { name: string; disabled: boolean }

const MAX_CONFIG_BYTES = 1024 * 1024
const MAX_CONNECTORS = 1000
const MAX_NAME_LENGTH = 512
const BYTE_ORDER_MARK = 0xfeff

/** The MCP servers agy loads for `home`: the global mcp_config.json, then each plugin under
 *  config/plugins that has a plugin.json and is not switched off in config.json. Plugin servers are
 *  named `<plugin>_<server>`. Only names and state leave these files; never commands, URLs or env. */
export async function readAntigravityConfiguredConnectors(
  home: string
): Promise<AgentSessionConnectorSnapshot | undefined> {
  const configDir = join(home, '.gemini', 'config')
  const disabledPlugins = await readDisabledPlugins(join(configDir, 'config.json'))
  const globalServers = (await readServerTable(join(configDir, 'mcp_config.json'))).flatMap(
    (entry) => connectorRow(entry.name, entry.disabled)
  )
  const pluginServers = await readPluginConnectors(join(configDir, 'plugins'), disabledPlugins)
  const servers = uniqueByName([...globalServers, ...pluginServers]).slice(0, MAX_CONNECTORS)
  return servers.length > 0
    ? readAgentSessionConnectorSnapshot({ observedAt: Date.now(), servers })
    : undefined
}

async function readPluginConnectors(
  pluginsDir: string,
  disabledPlugins: ReadonlySet<string>
): Promise<Connector[]> {
  const plugins = await readPluginDirectories(pluginsDir)
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
  const read = await readJsonFile(file, { allowBom: false })
  if (!read || !isRecord(read.value) || !isRecord(read.value.mcpServers)) {
    return []
  }
  return Object.entries(read.value.mcpServers).flatMap(([name, config]) =>
    isRecord(config) ? [{ name, disabled: config.disabled === true }] : []
  )
}

/** Plugins config.json switches off. agy tolerates a BOM here; a missing or unparseable file switches
 *  nothing off, so every plugin stays on. */
async function readDisabledPlugins(file: string): Promise<ReadonlySet<string>> {
  const read = await readJsonFile(file, { allowBom: true })
  const plugins = read && isRecord(read.value) ? read.value.plugins : undefined
  return new Set(
    isRecord(plugins)
      ? Object.entries(plugins).flatMap(([name, entry]) =>
          isRecord(entry) && entry.enabled === false ? [name] : []
        )
      : []
  )
}

/** A directory is a plugin only when it carries plugin.json, which agy uses as its marker. */
async function readPluginDirectories(pluginsDir: string): Promise<string[]> {
  const names = await readdir(pluginsDir).then(
    (entries) => entries,
    (): string[] => []
  )
  const plugins = await Promise.all(
    names
      .sort()
      .map(async (name) => ((await isFile(join(pluginsDir, name, 'plugin.json'))) ? name : null))
  )
  return plugins.filter((name): name is string => name !== null)
}

/** Parsed JSON as agy reads it: a comment or trailing comma makes the whole file unreadable. Returns
 *  undefined for a missing, oversized or unparseable file. */
async function readJsonFile(
  file: string,
  { allowBom }: { allowBom: boolean }
): Promise<{ value: unknown } | undefined> {
  let handle
  try {
    handle = await open(file, 'r')
  } catch {
    return undefined
  }
  try {
    const { size } = await handle.stat()
    if (size > MAX_CONFIG_BYTES) {
      return undefined
    }
    const text = await handle.readFile('utf8')
    const hasBom = text.charCodeAt(0) === BYTE_ORDER_MARK
    return { value: JSON.parse(allowBom && hasBom ? text.slice(1) : text) }
  } catch {
    return undefined
  } finally {
    await handle.close().catch(() => {})
  }
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

async function isFile(file: string): Promise<boolean> {
  return stat(file).then(
    (info) => info.isFile(),
    () => false
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
