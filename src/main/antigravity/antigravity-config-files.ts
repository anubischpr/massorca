import { open, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const MAX_CONFIG_BYTES = 1024 * 1024
const BYTE_ORDER_MARK = 0xfeff

/** A plugin agy loads from `config/plugins`. */
export type AntigravityPlugin = {
  /** Its directory name, which is also its key in config.json. */
  directory: string
  path: string
  /** Only an explicit `enabled: false` in config.json switches a plugin off. */
  enabled: boolean
  /** The `name` in its plugin.json, when that is a non-empty string. */
  manifestName: string | null
}

/** The plugins agy loads from `configDir/plugins`, in name order. */
export async function readAntigravityPlugins(configDir: string): Promise<AntigravityPlugin[]> {
  const pluginsDir = join(configDir, 'plugins')
  const [directories, disabled] = await Promise.all([
    readAntigravityPluginDirectories(pluginsDir),
    readAntigravityDisabledPlugins(join(configDir, 'config.json'))
  ])
  return Promise.all(
    directories.map(async (directory) => {
      const path = join(pluginsDir, directory)
      const manifest = await readAntigravityJsonFile(join(path, 'plugin.json'), { allowBom: false })
      const name = manifest && isJsonRecord(manifest.value) ? manifest.value.name : undefined
      return {
        directory,
        path,
        enabled: !disabled.has(directory),
        manifestName: typeof name === 'string' && name.trim() ? name.trim() : null
      }
    })
  )
}

/** A directory is a plugin only when it carries plugin.json, which agy uses as its marker. */
export async function readAntigravityPluginDirectories(pluginsDir: string): Promise<string[]> {
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

/** Plugins config.json switches off. agy tolerates a BOM here; a missing or unparseable file switches
 *  nothing off, so every plugin stays on. */
export async function readAntigravityDisabledPlugins(file: string): Promise<ReadonlySet<string>> {
  const read = await readAntigravityJsonFile(file, { allowBom: true })
  const plugins = read && isJsonRecord(read.value) ? read.value.plugins : undefined
  return new Set(
    isJsonRecord(plugins)
      ? Object.entries(plugins).flatMap(([name, entry]) =>
          isJsonRecord(entry) && entry.enabled === false ? [name] : []
        )
      : []
  )
}

/** Parsed JSON as agy reads it: a comment or trailing comma makes the whole file unreadable. Returns
 *  undefined for a missing, oversized or unparseable file. */
export async function readAntigravityJsonFile(
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

export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function isFile(file: string): Promise<boolean> {
  return stat(file).then(
    (info) => info.isFile(),
    () => false
  )
}
