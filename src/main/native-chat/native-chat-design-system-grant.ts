// The design system folder a chat's agent must be allowed to write when it lies outside the folder the
// agent launches in: a linked worktree shares the system of its main checkout, which its sandbox does not cover.

import { mkdir } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { designSystemFolderOfLaunchDirectory } from './prototype-design-system-files'

/**
 * The absolute design/system/ folder to grant an agent launched in `launchDirectory`, made if absent;
 * null when the launch directory already covers it, or the folder cannot be made. Never throws.
 */
export async function designSystemFolderToGrant(launchDirectory: string): Promise<string | null> {
  try {
    const folder = await designSystemFolderOfLaunchDirectory(launchDirectory)
    if (isInsideDirectory(resolve(launchDirectory), folder)) {
      return null
    }
    // Why made here: an agent can only be granted a folder that exists, and a child writes the system first.
    await mkdir(folder, { recursive: true })
    return folder
  } catch {
    return null
  }
}

function isInsideDirectory(directory: string, path: string): boolean {
  const from = relative(directory, path)
  return from === '' || (!from.startsWith('..') && !isAbsolute(from))
}
