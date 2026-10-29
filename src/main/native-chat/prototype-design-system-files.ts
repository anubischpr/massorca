// Reading a project's design system files under its root, and the summaries a prototype list carries.
// Every read goes through the contained reader. A file that is absent is left out; a file the project has
// but the host refuses to read (over the cap, not text, a path it does not follow) is reported by name and
// reason, so it is never mistaken for a project with no system.

import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  DESIGN_SYSTEM_COMPONENTS_FILE,
  DESIGN_SYSTEM_COMPONENTS_PATH,
  DESIGN_SYSTEM_FOLDER,
  DESIGN_SYSTEM_SOURCE_FILE,
  DESIGN_SYSTEM_SOURCE_PATH,
  DESIGN_SYSTEM_TOKENS_FILE,
  DESIGN_SYSTEM_TOKENS_PATH
} from '../../shared/prototype-design-system-files'
import {
  summarizeDesignSystem,
  type DesignSystemSummary
} from '../../shared/prototype-design-system-summary'
import { parseDesignTokens } from '../../shared/prototype-design-system-tokens'
import type { ReadPrototypeDesignSystemResult } from '../../shared/rpc-contract/prototype-params'
import { readNativeChatContainedTextFile } from './native-chat-visual-file-read'
import {
  resolveDesignSystemProject,
  type DesignSystemProject
} from './prototype-design-system-project'

const MAX_DESIGN_SYSTEM_FILE_BYTES = 512 * 1024
// The reader's message for an unexpected filesystem fault names only the error code, never a path.
const READ_FAULT_PREFIX = 'visual_read_failed:'

export type DesignSystemFiles = {
  tokensJson?: string
  componentsHtml?: string
  systemMd?: string
}

export type DesignSystemFilesRead = {
  files: DesignSystemFiles
  /** The root-relative paths of the files the project has but the host refused to read. */
  unreadableFileNames: string[]
}

/** What one file under `<root>/design/system/` came to. */
type DesignSystemFileRead =
  | { kind: 'text'; text: string }
  | { kind: 'absent' }
  | { kind: 'unreadable'; reason: string }

/** The text of a file under `<root>/design/system/`, absent when there is none, or unreadable with its reason. */
async function readDesignSystemFile(root: string, file: string): Promise<DesignSystemFileRead> {
  const folder = join(root, ...DESIGN_SYSTEM_FOLDER.split('/'))
  try {
    const result = await readNativeChatContainedTextFile(folder, file, undefined, {
      maxBytes: MAX_DESIGN_SYSTEM_FILE_BYTES,
      isAllowedName: (name) => name === file
    })
    if (result.ok && 'html' in result) {
      return { kind: 'text', text: result.html }
    }
    if (!result.ok && result.error === 'not_found') {
      return { kind: 'absent' }
    }
    return await unreadableFile(join(folder, file), file, result.ok ? 'unreadable' : result.error)
  } catch (error) {
    return await unreadableFile(join(folder, file), file, faultReasonOf(error))
  }
}

// The unreadable files logged so far, by path, with the version (mtime and size) each was logged at. A list
// refresh reads the same files again, so a file is logged once per version rather than on every read.
const loggedUnreadableVersions = new Map<string, string>()

// A file the project has but the host refused is logged by its name and reason only, never by its path.
async function unreadableFile(
  path: string,
  file: string,
  reason: string
): Promise<DesignSystemFileRead> {
  const version = await versionOf(path)
  if (loggedUnreadableVersions.get(path) !== version) {
    loggedUnreadableVersions.set(path, version)
    console.warn(`[prototypes] design system file ${file} was not read: ${reason}`)
  }
  return { kind: 'unreadable', reason }
}

async function versionOf(path: string): Promise<string> {
  const stats = await lstat(path).catch(() => null)
  return stats === null ? 'missing' : `${stats.mtimeMs}:${stats.size}`
}

function faultReasonOf(error: unknown): string {
  return error instanceof Error && error.message.startsWith(READ_FAULT_PREFIX)
    ? error.message.slice(READ_FAULT_PREFIX.length)
    : 'unreadable'
}

/** The three design system files of a project root, and the ones the project has but the host refused. */
export async function readDesignSystemFiles(root: string): Promise<DesignSystemFilesRead> {
  const [tokens, components, source] = await Promise.all([
    readDesignSystemFile(root, DESIGN_SYSTEM_TOKENS_FILE),
    readDesignSystemFile(root, DESIGN_SYSTEM_COMPONENTS_FILE),
    readDesignSystemFile(root, DESIGN_SYSTEM_SOURCE_FILE)
  ])
  return {
    files: {
      ...(tokens.kind === 'text' ? { tokensJson: tokens.text } : {}),
      ...(components.kind === 'text' ? { componentsHtml: components.text } : {}),
      ...(source.kind === 'text' ? { systemMd: source.text } : {})
    },
    unreadableFileNames: [
      ...(tokens.kind === 'unreadable' ? [DESIGN_SYSTEM_TOKENS_PATH] : []),
      ...(components.kind === 'unreadable' ? [DESIGN_SYSTEM_COMPONENTS_PATH] : []),
      ...(source.kind === 'unreadable' ? [DESIGN_SYSTEM_SOURCE_PATH] : [])
    ]
  }
}

/** The answer to `prototypes.readDesignSystem` for a chat's launch directory. */
export async function readDesignSystemOfLaunchDirectory(
  launchDirectory: string
): Promise<ReadPrototypeDesignSystemResult> {
  const project = await resolveDesignSystemProject(launchDirectory)
  const { files, unreadableFileNames } = await readDesignSystemFiles(project.root)
  const fileNames = [
    ...(files.tokensJson !== undefined ? [DESIGN_SYSTEM_TOKENS_PATH] : []),
    ...(files.componentsHtml !== undefined ? [DESIGN_SYSTEM_COMPONENTS_PATH] : []),
    ...(files.systemMd !== undefined ? [DESIGN_SYSTEM_SOURCE_PATH] : [])
  ]
  return {
    ok: true,
    projectKey: project.projectKey,
    projectName: project.projectName,
    fileNames,
    ...files,
    ...(unreadableFileNames.length > 0 ? { unreadableFileNames } : {})
  }
}

/** The version of a project's system, or undefined when it has none; a request records it when it is sent. */
export async function readDesignSystemVersion(
  launchDirectory: string
): Promise<number | undefined> {
  const { root } = await resolveDesignSystemProject(launchDirectory)
  const tokens = await readDesignSystemFile(root, DESIGN_SYSTEM_TOKENS_FILE)
  const parsed = tokens.kind === 'text' ? parseDesignTokens(tokens.text) : null
  return parsed === null ? undefined : summarizeDesignSystem(parsed).version
}

// The projects of one list answer: bounded, so a host with many chats reads at most this many roots.
const MAX_PROJECTS_SUMMARIZED = 50

export type ListedProject = DesignSystemProject & { system?: DesignSystemSummary }

/**
 * The project of each launch directory, and the system summary of each distinct root, read once. The
 * map is keyed by launch directory; a root beyond the bound is listed without a summary.
 */
export async function projectsOfLaunchDirectories(
  launchDirectories: Iterable<string>
): Promise<Map<string, ListedProject>> {
  const listed = new Map<string, ListedProject>()
  const summaryByRoot = new Map<string, DesignSystemSummary | null>()
  for (const launchDirectory of new Set(launchDirectories)) {
    const project = await resolveDesignSystemProject(launchDirectory)
    if (!summaryByRoot.has(project.root) && summaryByRoot.size < MAX_PROJECTS_SUMMARIZED) {
      summaryByRoot.set(project.root, await summarizeProjectSystem(project.root))
    }
    const system = summaryByRoot.get(project.root)
    listed.set(launchDirectory, { ...project, ...(system ? { system } : {}) })
  }
  return listed
}

async function summarizeProjectSystem(root: string): Promise<DesignSystemSummary | null> {
  const tokens = await readDesignSystemFile(root, DESIGN_SYSTEM_TOKENS_FILE)
  const parsed = tokens.kind === 'text' ? parseDesignTokens(tokens.text) : null
  return parsed === null ? null : summarizeDesignSystem(parsed)
}
