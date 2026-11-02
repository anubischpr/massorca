// Where this host's copy of the chat-visuals skill plugin lives. Resolved on the host that spawns
// the agent: a client's install path means nothing to another machine.

import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getAppEnvironment, hasAppEnvironment } from '../../shared/app-environment'

const PLUGIN_DIR_NAME = 'native-chat-visuals'
export const NATIVE_CHAT_VISUALS_SKILL_NAME = 'orca-chat-visuals'

export type NativeChatVisualsSkillLocation = {
  /** A Claude plugin folder: `.claude-plugin/plugin.json` plus `skills/<name>/SKILL.md`. */
  pluginDir: string
  /** The plugin's `skills` folder, the shape a Codex skill root takes. */
  skillsRoot: string
}

function candidatePluginDirs(): string[] {
  const candidates: string[] = []
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, PLUGIN_DIR_NAME))
  }
  const packaged = hasAppEnvironment() && getAppEnvironment().isPackaged()
  if (packaged) {
    // Why: plain-Node orcad has no resourcesPath; its build copies the folder into its own root.
    // Nothing else: an install must never load a skill from whatever checkout it was started in.
    candidates.push(join(getAppEnvironment().getAppPath(), PLUGIN_DIR_NAME))
    return candidates
  }
  // Development and test hosts run from a checkout.
  for (const root of [
    hasAppEnvironment() ? getAppEnvironment().getAppPath() : null,
    process.cwd()
  ]) {
    if (root) {
      candidates.push(join(root, 'resources', PLUGIN_DIR_NAME))
    }
  }
  return candidates
}

async function isComplete(pluginDir: string): Promise<boolean> {
  try {
    await Promise.all([
      access(join(pluginDir, '.claude-plugin', 'plugin.json')),
      access(join(pluginDir, 'skills', NATIVE_CHAT_VISUALS_SKILL_NAME, 'SKILL.md'))
    ])
    return true
  } catch {
    return false
  }
}

let found: NativeChatVisualsSkillLocation | null = null

/** This install's skill plugin, or null when it is missing; only a found location is remembered. */
export async function resolveNativeChatVisualsSkillLocation(
  candidates: readonly string[] = candidatePluginDirs()
): Promise<NativeChatVisualsSkillLocation | null> {
  if (found) {
    return found
  }
  for (const pluginDir of candidates) {
    if (await isComplete(pluginDir)) {
      found = { pluginDir, skillsRoot: join(pluginDir, 'skills') }
      return found
    }
  }
  return null
}

export function resetNativeChatVisualsSkillLocationForTests(): void {
  found = null
}

/** Ships in the same plugin, so plugin and skill-root agents load it with the visuals skill. */
export const NATIVE_CHAT_CHECKLIST_SKILL_NAME = 'orca-chat-checklist'

async function readSkillBody(skill: NativeChatVisualsSkillLocation, name: string) {
  try {
    const text = await readFile(join(skill.skillsRoot, name, 'SKILL.md'), 'utf8')
    const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()
    return body.length > 0 ? body : null
  } catch {
    return null
  }
}

/** The plugin's SKILL.md bodies (visuals, then the checklist), frontmatter dropped, for an agent
 *  that takes instructions as text; null when the visuals skill cannot be read. */
export async function readNativeChatVisualsInstructions(
  skill: NativeChatVisualsSkillLocation
): Promise<string | null> {
  const visuals = await readSkillBody(skill, NATIVE_CHAT_VISUALS_SKILL_NAME)
  if (visuals === null) {
    return null
  }
  const checklist = await readSkillBody(skill, NATIVE_CHAT_CHECKLIST_SKILL_NAME)
  return checklist === null ? visuals : `${visuals}\n\n${checklist}`
}
