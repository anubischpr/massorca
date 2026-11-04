// The host's copies of each design system version it sees. Copies live under the host's state directory, never in
// the project, so git never sees them. A copy is written once and never overwritten.

import { createHash } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { mkdir, mkdtemp, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DESIGN_SYSTEM_COMPONENTS_FILE,
  DESIGN_SYSTEM_SOURCE_FILE,
  DESIGN_SYSTEM_TOKENS_FILE
} from '../../shared/prototype-design-system-files'
import { summarizeDesignSystem } from '../../shared/prototype-design-system-summary'
import { parseDesignTokens } from '../../shared/prototype-design-system-tokens'
import { readNativeChatContainedTextFile } from './native-chat-visual-file-read'
import { MAX_DESIGN_SYSTEM_FILE_BYTES, readDesignSystemFile } from './prototype-design-system-files'

const STORE_FOLDER = 'prototype-design-system-versions'
const STAGING_PREFIX = '.staging-'
const SAVED_FOLDER_PATTERN = /^v([1-9]\d*)$/u

/** The text of a version's three files, each left out when the version has none. */
export type DesignSystemVersionFiles = {
  tokensJson?: string
  componentsHtml?: string
  systemMd?: string
}

/** The host folder of one design system's copies; the name is a hash of its root, so no path is ever a name. */
export function storeFolderOf(stateDirectory: string, root: string): string {
  const key = createHash('sha256').update(root).digest('hex').slice(0, 32)
  return join(stateDirectory, STORE_FOLDER, key)
}

export function savedFolderOf(store: string, version: number): string {
  return join(store, `v${version}`)
}

/** Saves a copy of the current version the first time the host sees it; a failure is logged, never thrown. */
export async function keepCurrentVersionSafely(
  stateDirectory: string,
  root: string
): Promise<void> {
  try {
    await keepCurrentVersion(stateDirectory, root)
  } catch (error) {
    logDesignSystemVersionFailure('keeping a design system version', error)
  }
}

/** Why the reason is the error code, never the message, which can carry a host path. */
export function logDesignSystemVersionFailure(action: string, error: unknown): void {
  const code = error instanceof Error && 'code' in error ? String(error.code) : 'unknown'
  console.warn(`[prototypes] ${action} failed: ${code}`)
}

/** The saved copy of a version, or undefined when the host never saved it; a copy's file that cannot be read is left out. */
export async function readSavedFiles(
  folder: string
): Promise<DesignSystemVersionFiles | undefined> {
  const tokensJson = await readSavedText(folder, DESIGN_SYSTEM_TOKENS_FILE)
  if (tokensJson === undefined) {
    return undefined
  }
  const [componentsHtml, systemMd] = await Promise.all([
    readSavedText(folder, DESIGN_SYSTEM_COMPONENTS_FILE),
    readSavedText(folder, DESIGN_SYSTEM_SOURCE_FILE)
  ])
  return {
    tokensJson,
    ...(componentsHtml !== undefined ? { componentsHtml } : {}),
    ...(systemMd !== undefined ? { systemMd } : {})
  }
}

/** The version numbers the host holds a copy of, in no order. */
export async function savedVersionsOf(store: string): Promise<number[]> {
  const entries: Dirent[] = await readdir(store, { withFileTypes: true }).catch((): Dirent[] => [])
  return entries.flatMap((entry) => {
    const match = SAVED_FOLDER_PATTERN.exec(entry.name)
    return entry.isDirectory() && match?.[1] !== undefined ? [Number(match[1])] : []
  })
}

/**
 * Ensures the current version has a copy. `absent`: no tokens.json, so nothing to keep; `invalid`: a tokens.json
 * that is not a version (unreadable or not valid), which cannot be kept; `kept`: a copy exists. A failed write throws.
 */
export async function keepCurrentVersion(
  stateDirectory: string,
  root: string
): Promise<'absent' | 'invalid' | 'kept'> {
  const tokens = await readDesignSystemFile(root, DESIGN_SYSTEM_TOKENS_FILE)
  if (tokens.kind === 'absent') {
    return 'absent'
  }
  const parsed = tokens.kind === 'text' ? parseDesignTokens(tokens.text) : null
  if (tokens.kind !== 'text' || parsed === null) {
    return 'invalid'
  }
  const store = storeFolderOf(stateDirectory, root)
  const target = savedFolderOf(store, summarizeDesignSystem(parsed).version)
  if (await exists(target)) {
    return 'kept'
  }
  const [components, source] = await Promise.all([
    readDesignSystemFile(root, DESIGN_SYSTEM_COMPONENTS_FILE),
    readDesignSystemFile(root, DESIGN_SYSTEM_SOURCE_FILE)
  ])
  await writeSavedFilesOnce(store, target, {
    tokensJson: tokens.text,
    ...(components.kind === 'text' ? { componentsHtml: components.text } : {}),
    ...(source.kind === 'text' ? { systemMd: source.text } : {})
  })
  return 'kept'
}

/** Writes a copy in a staging folder and renames it into place, so a reader never sees half of one. */
async function writeSavedFilesOnce(
  store: string,
  target: string,
  files: DesignSystemVersionFiles
): Promise<void> {
  await mkdir(store, { recursive: true })
  const staging = await mkdtemp(join(store, STAGING_PREFIX))
  try {
    await writeNamedFiles(staging, files)
    await rename(staging, target)
  } catch (error) {
    // Why: a concurrent read may have renamed its own copy first; the saved copy is then whole, so it stands.
    if (!(await exists(target))) {
      throw error
    }
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

async function writeNamedFiles(folder: string, files: DesignSystemVersionFiles): Promise<void> {
  const named: [string, string | undefined][] = [
    [DESIGN_SYSTEM_TOKENS_FILE, files.tokensJson],
    [DESIGN_SYSTEM_COMPONENTS_FILE, files.componentsHtml],
    [DESIGN_SYSTEM_SOURCE_FILE, files.systemMd]
  ]
  for (const [name, text] of named) {
    if (text !== undefined) {
      await writeFile(join(folder, name), text)
    }
  }
}

async function readSavedText(folder: string, name: string): Promise<string | undefined> {
  const result = await readNativeChatContainedTextFile(folder, name, undefined, {
    maxBytes: MAX_DESIGN_SYSTEM_FILE_BYTES,
    isAllowedName: (file) => file === name
  })
  return result.ok && 'html' in result ? result.html : undefined
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  )
}
