// Whether MassOrca can read a chat's design system, and why not: the verdict behind `orca prototypes design-system`.
import type { ReadPrototypeDesignSystemResult } from './rpc-contract/prototype-params'
import {
  DESIGN_SYSTEM_COMPONENTS_FILE,
  DESIGN_SYSTEM_COMPONENTS_PATH,
  DESIGN_SYSTEM_FOLDER,
  DESIGN_SYSTEM_SOURCE_FILE,
  DESIGN_SYSTEM_SOURCE_PATH,
  DESIGN_SYSTEM_TOKENS_FILE,
  DESIGN_SYSTEM_TOKENS_PATH
} from './prototype-design-system-files'
import { summarizeDesignSystem } from './prototype-design-system-summary'
import { parseDesignTokens } from './prototype-design-system-tokens'

/** The verdict on one chat's design system; its JSON is the stable output of `orca prototypes design-system --json`. */
export type PrototypeDesignSystemReadability = {
  readable: boolean
  /** The absolute design/system folder the host reads; absent from a host that predates it. */
  folderPath?: string
  /** The system's version, when its tokens.json parses. */
  version?: number
  /** Root-relative files the host read. */
  filesRead: string[]
  /** The files MassOrca reads that the project has no trace of. */
  missing: string[]
  /** The files the project has but MassOrca refused to read. */
  unreadable: string[]
  /** Root-relative entries of the folder that MassOrca does not read. */
  otherFiles: string[]
  /** One line per reason, blocking reasons first. */
  reasons: string[]
}

const NOT_FOUND_REASON = {
  chat: 'The chat was not found on this host, or it is not a local chat.',
  project: 'The project folder was not found on this host, or this caller may not read it.'
}
const FOLDER_PREFIX = `${DESIGN_SYSTEM_FOLDER}/`
const READ_FILES = `${DESIGN_SYSTEM_TOKENS_FILE}, ${DESIGN_SYSTEM_COMPONENTS_FILE} and ${DESIGN_SYSTEM_SOURCE_FILE}`

/** Why a chat's or a project folder's design system is readable or not; only a valid tokens.json makes it readable. */
export function checkDesignSystemReadability(
  result: ReadPrototypeDesignSystemResult,
  readThrough: 'chat' | 'project' = 'chat'
): PrototypeDesignSystemReadability {
  if (!result.ok) {
    return {
      readable: false,
      filesRead: [],
      missing: [],
      unreadable: [],
      otherFiles: [],
      reasons: [NOT_FOUND_REASON[readThrough]]
    }
  }
  const unreadable = result.unreadableFileNames ?? []
  const otherFiles = result.otherFileNames ?? []
  const parsed = result.tokensJson === undefined ? null : parseDesignTokens(result.tokensJson)
  // Why: a file that exists but was refused is unreadable, never missing.
  const missing = [
    { path: DESIGN_SYSTEM_TOKENS_PATH, text: result.tokensJson },
    { path: DESIGN_SYSTEM_COMPONENTS_PATH, text: result.componentsHtml },
    { path: DESIGN_SYSTEM_SOURCE_PATH, text: result.systemMd }
  ]
    .filter(({ path, text }) => text === undefined && !unreadable.includes(path))
    .map(({ path }) => path)
  const reasons = [
    ...(missing.includes(DESIGN_SYSTEM_TOKENS_PATH)
      ? [`${DESIGN_SYSTEM_TOKENS_PATH} is missing; MassOrca reads the design system from it.`]
      : []),
    ...(result.tokensJson !== undefined && parsed === null
      ? [
          `${DESIGN_SYSTEM_TOKENS_PATH} is present but is not a valid design system; it must be a JSON object.`
        ]
      : []),
    ...unreadable.map(
      (path) =>
        `${path} is present but could not be read (over the size limit, not text, or a path MassOrca does not follow).`
    ),
    ...missing
      .filter((path) => path !== DESIGN_SYSTEM_TOKENS_PATH)
      .map((path) => `${path} is missing (warning, not blocking).`),
    ...(otherFiles.length > 0
      ? [
          `${DESIGN_SYSTEM_FOLDER} holds ${otherFiles.map(withoutFolderPrefix).join(', ')}, which MassOrca does not read; it reads ${READ_FILES}`
        ]
      : [])
  ]
  return {
    readable: parsed !== null,
    ...(result.folderPath !== undefined ? { folderPath: result.folderPath } : {}),
    ...(parsed !== null ? { version: summarizeDesignSystem(parsed).version } : {}),
    filesRead: result.fileNames,
    missing,
    unreadable,
    otherFiles,
    reasons
  }
}

function withoutFolderPrefix(name: string): string {
  return name.startsWith(FOLDER_PREFIX) ? name.slice(FOLDER_PREFIX.length) : name
}
