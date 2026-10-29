// Reading a project's design system files under its root, and the summaries a prototype list carries.
// Every read goes through the contained reader and answers "absent" rather than throwing: a project
// without a system, or a file the host cannot read, holds nothing to show.

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
import { logPrototypeFailure } from './prototype-request-disk'
import {
  resolveDesignSystemProject,
  type DesignSystemProject
} from './prototype-design-system-project'

const MAX_DESIGN_SYSTEM_FILE_BYTES = 512 * 1024

export type DesignSystemFiles = {
  tokensJson?: string
  componentsHtml?: string
  systemMd?: string
}

/** The text of a file under `<root>/design/system/`, or undefined when it is absent, too large or not text. */
async function readDesignSystemFile(root: string, file: string): Promise<string | undefined> {
  try {
    const result = await readNativeChatContainedTextFile(
      join(root, ...DESIGN_SYSTEM_FOLDER.split('/')),
      file,
      undefined,
      { maxBytes: MAX_DESIGN_SYSTEM_FILE_BYTES, isAllowedName: (name) => name === file }
    )
    return result.ok && 'html' in result ? result.html : undefined
  } catch (error) {
    logPrototypeFailure('reading a design system file', error)
    return undefined
  }
}

/** The three design system files of a project root; a file that cannot be read is left out. */
export async function readDesignSystemFiles(root: string): Promise<DesignSystemFiles> {
  const [tokensJson, componentsHtml, systemMd] = await Promise.all([
    readDesignSystemFile(root, DESIGN_SYSTEM_TOKENS_FILE),
    readDesignSystemFile(root, DESIGN_SYSTEM_COMPONENTS_FILE),
    readDesignSystemFile(root, DESIGN_SYSTEM_SOURCE_FILE)
  ])
  return {
    ...(tokensJson !== undefined ? { tokensJson } : {}),
    ...(componentsHtml !== undefined ? { componentsHtml } : {}),
    ...(systemMd !== undefined ? { systemMd } : {})
  }
}

/** The answer to `prototypes.readDesignSystem` for a chat's launch directory. */
export async function readDesignSystemOfLaunchDirectory(
  launchDirectory: string
): Promise<ReadPrototypeDesignSystemResult> {
  const project = await resolveDesignSystemProject(launchDirectory)
  const files = await readDesignSystemFiles(project.root)
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
    ...files
  }
}

/** The version of a project's system, or undefined when it has none; a request records it when it is sent. */
export async function readDesignSystemVersion(
  launchDirectory: string
): Promise<number | undefined> {
  const { root } = await resolveDesignSystemProject(launchDirectory)
  const tokensJson = await readDesignSystemFile(root, DESIGN_SYSTEM_TOKENS_FILE)
  const parsed = tokensJson === undefined ? null : parseDesignTokens(tokensJson)
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
  const tokensJson = await readDesignSystemFile(root, DESIGN_SYSTEM_TOKENS_FILE)
  const parsed = tokensJson === undefined ? null : parseDesignTokens(tokensJson)
  return parsed === null ? null : summarizeDesignSystem(parsed)
}
