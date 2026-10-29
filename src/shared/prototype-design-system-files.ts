// Where a project keeps its design system, and the choices a prototype request makes about it.

/** Folder of the system, relative to the project root. */
export const DESIGN_SYSTEM_FOLDER = 'design/system'
export const DESIGN_SYSTEM_TOKENS_FILE = 'tokens.json'
export const DESIGN_SYSTEM_COMPONENTS_FILE = 'components.html'
export const DESIGN_SYSTEM_SOURCE_FILE = 'system.md'

/** The three files, relative to the project root. */
export const DESIGN_SYSTEM_TOKENS_PATH = `${DESIGN_SYSTEM_FOLDER}/${DESIGN_SYSTEM_TOKENS_FILE}`
export const DESIGN_SYSTEM_COMPONENTS_PATH = `${DESIGN_SYSTEM_FOLDER}/${DESIGN_SYSTEM_COMPONENTS_FILE}`
export const DESIGN_SYSTEM_SOURCE_PATH = `${DESIGN_SYSTEM_FOLDER}/${DESIGN_SYSTEM_SOURCE_FILE}`

/** What a prototype request does with the project's system: build on it, propose one first, or ignore it. */
export const PROTOTYPE_DESIGN_SYSTEM_MODES = ['use', 'propose', 'skip'] as const

export type PrototypeDesignSystemMode = (typeof PROTOTYPE_DESIGN_SYSTEM_MODES)[number]

/** Opens the hidden block of every design system message MassOrca writes; a reader trusts a marker only before it. */
export const DESIGN_SYSTEM_FILES_LINE_PREFIX = 'Design system files:'
