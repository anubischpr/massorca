// The versions of a project's design system as the host answers them: listed, opened read-only, and restored.
// A restore copies a saved version into a new current version; a version is never overwritten or deleted.

import type {
  DesignSystemVersionListed,
  ListDesignSystemVersionsResult,
  ReadDesignSystemVersionResult,
  RestoreDesignSystemVersionResult
} from '../../shared/rpc-contract/prototype-params'
import {
  DESIGN_SYSTEM_COMPONENTS_PATH,
  DESIGN_SYSTEM_SOURCE_PATH,
  DESIGN_SYSTEM_TOKENS_FILE,
  DESIGN_SYSTEM_TOKENS_PATH
} from '../../shared/prototype-design-system-files'
import { summarizeDesignSystem } from '../../shared/prototype-design-system-summary'
import {
  isRecord,
  parseDesignTokenTree,
  type DesignSystemHistoryEntry,
  type ParsedDesignTokens
} from '../../shared/prototype-design-system-tokens'
import { designSystemRootOf, readDesignSystemFile } from './prototype-design-system-files'
import {
  resolveDesignSystemProject,
  type DesignSystemProject
} from './prototype-design-system-project'
import {
  keepCurrentVersion,
  keepCurrentVersionSafely,
  logDesignSystemVersionFailure,
  readSavedFiles,
  savedFolderOf,
  savedVersionsOf,
  storeFolderOf,
  type DesignSystemVersionFiles
} from './prototype-design-system-version-store'
import { tokensOfRestore, writeDesignSystemFiles } from './prototype-design-system-version-restore'

export type DesignSystemVersionOptions = {
  stateDirectory: string
  launchDirectory: string
}

type CurrentTokens = { raw: Record<string, unknown>; parsed: ParsedDesignTokens }

/** Keeps a copy of the project's current version, if the host has none of it yet. */
export async function keepDesignSystemVersionOfLaunchDirectory(
  stateDirectory: string,
  launchDirectory: string
): Promise<void> {
  const { root } = await systemOfLaunchDirectory(launchDirectory)
  await keepCurrentVersionSafely(stateDirectory, root)
}

/** Every version of the project's system: the history, the current version and each saved copy, newest first. */
export async function listDesignSystemVersionsOfLaunchDirectory(
  options: DesignSystemVersionOptions
): Promise<ListDesignSystemVersionsResult> {
  const { root } = await systemOfLaunchDirectory(options.launchDirectory)
  await keepCurrentVersionSafely(options.stateDirectory, root)
  const current = await readCurrentTokens(root)
  return {
    ok: true,
    versions: mergeVersions({
      history: current?.parsed.meta.history ?? [],
      currentVersion: current ? summarizeDesignSystem(current.parsed).version : undefined,
      currentAt: current?.parsed.meta.updatedAt,
      saved: await savedVersionsOf(storeFolderOf(options.stateDirectory, root))
    })
  }
}

/** The files of one saved version, read from its copy; not_found when the host never saved it. */
export async function readDesignSystemVersionOfLaunchDirectory(
  options: DesignSystemVersionOptions & { version: number }
): Promise<ReadDesignSystemVersionResult> {
  const { project, root } = await systemOfLaunchDirectory(options.launchDirectory)
  await keepCurrentVersionSafely(options.stateDirectory, root)
  const files = await readSavedFiles(
    savedFolderOf(storeFolderOf(options.stateDirectory, root), options.version)
  )
  if (files === undefined) {
    return { ok: false, error: 'not_found' }
  }
  return {
    ok: true,
    projectKey: project.projectKey,
    projectName: project.projectName,
    fileNames: fileNamesOf(files),
    ...files
  }
}

/**
 * Makes the project's system match a saved version, as the next version, and saves that new version. The current
 * version is kept first; a restore that cannot keep it changes nothing. Only the three known files are written or
 * removed, so the system afterwards is exactly the restored version's.
 */
export async function restoreDesignSystemVersionOfLaunchDirectory(
  options: DesignSystemVersionOptions & { version: number; canAct: () => boolean }
): Promise<RestoreDesignSystemVersionResult> {
  if (!options.canAct()) {
    return { ok: false, error: 'not_found' }
  }
  const { root } = await systemOfLaunchDirectory(options.launchDirectory)
  if (!(await keptBeforeReplacing(options.stateDirectory, root))) {
    return { ok: false, error: 'unwritable' }
  }
  const store = storeFolderOf(options.stateDirectory, root)
  const current = await readCurrentTokens(root)
  const currentVersion = current ? summarizeDesignSystem(current.parsed).version : undefined
  if (currentVersion === options.version) {
    return { ok: false, error: 'current' }
  }
  const source = await readSavedFiles(savedFolderOf(store, options.version))
  if (source === undefined) {
    return { ok: false, error: 'not_found' }
  }
  const sourceTokens = parseTokensText(source.tokensJson ?? '')
  if (sourceTokens === undefined) {
    return { ok: false, error: 'unwritable' }
  }
  const known = [
    ...(currentVersion !== undefined ? [currentVersion] : []),
    ...(await savedVersionsOf(store)),
    ...(current?.parsed.meta.history.map((entry) => entry.version) ?? [])
  ]
  const next = Math.max(0, ...known) + 1
  const tokens = tokensOfRestore({
    source: sourceTokens.raw,
    current: current?.raw,
    status: sourceTokens.parsed.meta.status,
    version: next,
    restoredFrom: options.version,
    at: new Date().toISOString()
  })
  try {
    await writeDesignSystemFiles(root, {
      ...(source.componentsHtml !== undefined ? { componentsHtml: source.componentsHtml } : {}),
      ...(source.systemMd !== undefined ? { systemMd: source.systemMd } : {}),
      tokensJson: JSON.stringify(tokens, null, 2)
    })
  } catch (error) {
    logDesignSystemVersionFailure('restoring a design system version', error)
    return { ok: false, error: 'unwritable' }
  }
  await keepCurrentVersionSafely(options.stateDirectory, root)
  return { ok: true, version: next }
}

/** Why before any write: a restore replaces the current files, so the current version must have a copy first. */
async function keptBeforeReplacing(stateDirectory: string, root: string): Promise<boolean> {
  try {
    const kept = await keepCurrentVersion(stateDirectory, root)
    if (kept === 'invalid') {
      console.warn(
        '[prototypes] restoring a design system version refused: tokens.json is not a version to keep'
      )
    }
    return kept !== 'invalid'
  } catch (error) {
    logDesignSystemVersionFailure('keeping the current design system version', error)
    return false
  }
}

async function systemOfLaunchDirectory(
  launchDirectory: string
): Promise<{ project: DesignSystemProject; root: string }> {
  const project = await resolveDesignSystemProject(launchDirectory)
  return { project, root: await designSystemRootOf(project) }
}

async function readCurrentTokens(root: string): Promise<CurrentTokens | undefined> {
  const tokens = await readDesignSystemFile(root, DESIGN_SYSTEM_TOKENS_FILE)
  return tokens.kind === 'text' ? parseTokensText(tokens.text) : undefined
}

function parseTokensText(text: string): CurrentTokens | undefined {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!isRecord(raw)) {
    return undefined
  }
  const parsed = parseDesignTokenTree(raw)
  return parsed === null ? undefined : { raw, parsed }
}

function mergeVersions(input: {
  history: DesignSystemHistoryEntry[]
  currentVersion: number | undefined
  currentAt: string | undefined
  saved: number[]
}): DesignSystemVersionListed[] {
  const numbers = new Set<number>([
    ...input.history.map((entry) => entry.version),
    ...input.saved,
    ...(input.currentVersion !== undefined ? [input.currentVersion] : [])
  ])
  return [...numbers]
    .sort((left, right) => right - left)
    .map((version) => {
      const isCurrent = version === input.currentVersion
      const at =
        input.history.find((entry) => entry.version === version)?.at ??
        (isCurrent ? input.currentAt : undefined)
      return {
        version,
        ...(at !== undefined ? { at } : {}),
        saved: input.saved.includes(version),
        current: isCurrent
      }
    })
}

function fileNamesOf(files: DesignSystemVersionFiles): string[] {
  return [
    ...(files.tokensJson !== undefined ? [DESIGN_SYSTEM_TOKENS_PATH] : []),
    ...(files.componentsHtml !== undefined ? [DESIGN_SYSTEM_COMPONENTS_PATH] : []),
    ...(files.systemMd !== undefined ? [DESIGN_SYSTEM_SOURCE_PATH] : [])
  ]
}
