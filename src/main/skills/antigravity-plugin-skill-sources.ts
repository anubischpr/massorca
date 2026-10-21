import { join } from 'node:path'
import {
  readAntigravityPlugins,
  type AntigravityPlugin
} from '../antigravity/antigravity-config-files'
import { stablePathId, type SkillScanRoot } from './skill-discovery-sources'

// Why: the plugin name prefixes each skill token, so only a name the picker inserts unchanged counts.
const SAFE_PLUGIN_NAME = /^[A-Za-z0-9._-]+$/u

/** The name agy lists a plugin's skills under: its manifest name, or its directory when that is not plain. */
function promotedPluginName(plugin: AntigravityPlugin): string | null {
  return (
    [plugin.manifestName, plugin.directory].find(
      (name): name is string => name !== null && SAFE_PLUGIN_NAME.test(name)
    ) ?? null
  )
}

/**
 * The `skills` folder of each plugin agy loads for `homeDir` and has switched on. agy lists these skills
 * as `<plugin>:<skill>`, the token the `/` menu inserts, and reports the plugin under its manifest name.
 */
export async function discoverAntigravityPluginSkillSources(args: {
  homeDir: string
}): Promise<SkillScanRoot[]> {
  const plugins = await readAntigravityPlugins(join(args.homeDir, '.gemini', 'config'))
  return plugins.flatMap((plugin): SkillScanRoot[] => {
    const namePrefix = promotedPluginName(plugin)
    if (!plugin.enabled || namePrefix === null) {
      return []
    }
    const skillsPath = join(plugin.path, 'skills')
    return [
      {
        id: `antigravity-plugin-${stablePathId(skillsPath)}`,
        label: `Antigravity plugin ${namePrefix}`,
        path: skillsPath,
        sourceKind: 'plugin',
        providers: ['agent-skills'],
        owner: 'antigravity',
        namePrefix
      }
    ]
  })
}
