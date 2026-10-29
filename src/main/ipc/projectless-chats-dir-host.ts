import { homedir } from 'node:os'
import { getDefaultProjectlessChatsDir, normalizeProjectlessChatsDir } from '../../shared/constants'
import type { GlobalSettings } from '../../shared/global-settings-types'

export function defaultProjectlessChatsDir(): string {
  return getDefaultProjectlessChatsDir(homedir())
}

/** An empty patch when the renderer did not send the key, so callers can always spread it. */
export function projectlessChatsDirPatch(
  updates: Partial<GlobalSettings>
): Partial<GlobalSettings> {
  if (!('projectlessChatsDir' in updates)) {
    return {}
  }
  return {
    projectlessChatsDir: normalizeProjectlessChatsDir(updates.projectlessChatsDir, homedir())
  }
}
