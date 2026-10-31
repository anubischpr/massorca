// The hidden instruction that tells an agent how to read, detect, propose and write a project's
// design system: the text a prototype request carries, and the format of the files it names.
import {
  DESIGN_SYSTEM_COMPONENTS_FILE,
  DESIGN_SYSTEM_COMPONENTS_PATH,
  DESIGN_SYSTEM_SOURCE_FILE,
  DESIGN_SYSTEM_SOURCE_PATH,
  DESIGN_SYSTEM_TOKENS_FILE,
  DESIGN_SYSTEM_TOKENS_PATH,
  PROTOTYPE_DESIGN_SYSTEM_MODES,
  type PrototypeDesignSystemMode
} from './prototype-design-system-files'

export type DesignSystemInstructionOptions = {
  /** The system's absolute folder on the agent's host; absent, the instruction names project-relative paths. */
  folder?: string
  /** No user reviews the first result (a delegated child): a missing system is created and the work goes on. */
  unattended?: boolean
}

// The three file paths an instruction names: under the absolute folder when there is one.
function systemFilePaths(folder: string | undefined): {
  tokens: string
  components: string
  source: string
} {
  const base = folder?.trim().replace(/[\\/]+$/u, '')
  if (!base) {
    return {
      tokens: DESIGN_SYSTEM_TOKENS_PATH,
      components: DESIGN_SYSTEM_COMPONENTS_PATH,
      source: DESIGN_SYSTEM_SOURCE_PATH
    }
  }
  return {
    tokens: `${base}/${DESIGN_SYSTEM_TOKENS_FILE}`,
    components: `${base}/${DESIGN_SYSTEM_COMPONENTS_FILE}`,
    source: `${base}/${DESIGN_SYSTEM_SOURCE_FILE}`
  }
}

// The steps for a system that does not exist yet: the first read and the re-detect both spell them out.
const DERIVE_STEPS =
  'derive tokens from the project (CSS variables, theme or Tailwind config, style guide docs, existing components), list each source, write the three files,'
const DERIVE_MISSING_SYSTEM = `${DERIVE_STEPS} and stop.`
// Why: no user reviews a child's system before its directions, so the child carries on after writing it.
const DERIVE_MISSING_SYSTEM_UNATTENDED = `${DERIVE_STEPS} and then go on to write the directions: nobody reviews the system first, so do not stop.`
const NO_IDENTITY_FOR_REVIEW =
  'If the project has no identity, propose a system with 2 palette options, write it, and stop for review.'
const NO_IDENTITY_UNATTENDED =
  'If the project has no identity, choose the palette that fits the request, write the system, and go on to the directions without stopping.'
// Tells the user at a glance which of the two happened.
const REPORT_LINE =
  'Start your visible reply with one line saying whether the design system was reused (with its version) or created.'
// Why: a child's own reply is not read by the user; its report is what the parent session passes on.
const REPORT_LINE_UNATTENDED = `${REPORT_LINE} Begin the --body of your worker_done report with that same statement.`

/**
 * Appended to every prototype request except "Skip", before the format of the files it names. The system is built
 * once: a later request reuses it as it is, and a direction that needs more adds only what it lacks.
 */
export function designSystemReadInstruction(options: DesignSystemInstructionOptions = {}): string {
  const paths = systemFilePaths(options.folder)
  const files =
    options.folder === undefined
      ? `${paths.tokens}, components.html and system.md`
      : `${paths.tokens}, ${paths.components} and ${paths.source}`
  const unattended = options.unattended === true
  return `Before designing, check whether ${files} exist: list their folder or test each path, and read a file only when it exists. If they are missing: ${unattended ? DERIVE_MISSING_SYSTEM_UNATTENDED : DERIVE_MISSING_SYSTEM} If they exist, reuse them as they are: never regenerate, rewrite or reformat them. If a direction needs a token or component the system lacks, add only that one, keep every existing token, value and component unchanged, bump the version with a history entry, and note the addition in system.md. ${unattended ? NO_IDENTITY_UNATTENDED : NO_IDENTITY_FOR_REVIEW} Build every direction only with these tokens and components. ${unattended ? REPORT_LINE_UNATTENDED : REPORT_LINE}`
}

export const DESIGN_SYSTEM_READ_INSTRUCTION = designSystemReadInstruction()

/** The re-detect message's instruction: the sources are read again, and only what they changed is written. */
export const DESIGN_SYSTEM_REDETECT_INSTRUCTION = `Re-read the project's sources and compare them with the existing design/system files. Check which of those files exist first: list their folder or test each path, and read only the ones that exist. Change only the tokens and components whose source changed, add ones that are new, keep every other token, value and component exactly as it is, bump the version with a history entry, and update the sources in tokens.json and system.md. If the files are missing, ${DERIVE_MISSING_SYSTEM}`

/** The two file contracts, briefly: what an agent writes and what MassOrca reads back. */
export function designSystemFormatInstruction(folder?: string): string {
  const paths = systemFilePaths(folder)
  return [
    'Design system file formats:',
    `${paths.tokens}: W3C design tokens. Groups color, type, space, radius, shadow and motion, each token {"$type"?, "$value": "<string>", "$description"?}; a type token may add "$extensions": {"massorca": {"weight": 600}}. The root "$extensions.massorca" holds {"version": <integer, 1 for a new system>, "status": "detected" | "proposed", "agent": "<your name>", "updatedAt": "YYYY-MM-DD", "history": [{"version": 1, "status": "detected", "at": "YYYY-MM-DD"}], "sources": [{"path": "<file read>", "took": "<what was taken from it>"}], "palettes": [{"id": "A", "name": "<name>", "note": "<one line>", "swatches": ["#rrggbb"], "tokens": {"color.primary": "#rrggbb"}}]}; palettes only for a proposed system. A token's id is group.name and its CSS variable is --group-name.`,
    `${paths.components}: one <style> block plus one <section data-component="Name" data-variants="primary secondary" data-variant-options="primary secondary disabled hover" data-bind-background="color.primary" data-bind-radius="radius.md">...</section> per component. In the markup use var(--bind-<prop>) for a bound property and var(--<token css variable>) otherwise. No scripts and no external resources.`,
    `${paths.source}: the rules of the system and its sources, in prose.`
  ].join('\n')
}

export const DESIGN_SYSTEM_FORMAT_INSTRUCTION = designSystemFormatInstruction()

/** The three files an instruction names, as one sentence fragment: project-relative, or under the absolute folder. */
export function designSystemFilesList(folder?: string): string {
  const paths = systemFilePaths(folder)
  return `${paths.tokens}, ${paths.components} and ${paths.source}`
}

/** Whether a request with this mode carries the design system instruction. */
export function usesDesignSystemInstruction(mode: PrototypeDesignSystemMode | undefined): boolean {
  return mode !== undefined && mode !== 'skip' && PROTOTYPE_DESIGN_SYSTEM_MODES.includes(mode)
}

/** The lines a prototype request adds after its direction instruction for "Use it" or "Propose one first". */
export function designSystemRequestInstruction(
  options: DesignSystemInstructionOptions = {}
): string {
  return `${designSystemReadInstruction(options)}\n${designSystemFormatInstruction(options.folder)}`
}
