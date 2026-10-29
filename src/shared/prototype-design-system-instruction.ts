// The hidden instruction that tells an agent how to read, detect, propose and write a project's
// design system: the text a prototype request carries, and the format of the files it names.
import {
  DESIGN_SYSTEM_COMPONENTS_PATH,
  DESIGN_SYSTEM_SOURCE_PATH,
  DESIGN_SYSTEM_TOKENS_PATH,
  PROTOTYPE_DESIGN_SYSTEM_MODES,
  type PrototypeDesignSystemMode
} from './prototype-design-system-files'

/**
 * Appended to every prototype request except "Skip", before the format of the files it names. The system is built
 * once: a later request reuses it as it is, and a direction that needs more adds only what it lacks.
 */
// The steps for a system that does not exist yet: the first read and the re-detect both spell them out.
const DERIVE_MISSING_SYSTEM =
  'derive tokens from the project (CSS variables, theme or Tailwind config, style guide docs, existing components), list each source, write the three files, and stop.'

export const DESIGN_SYSTEM_READ_INSTRUCTION = `Before designing, read design/system/tokens.json, components.html and system.md. If they are missing: ${DERIVE_MISSING_SYSTEM} If they exist, reuse them as they are: never regenerate, rewrite or reformat them. If a direction needs a token or component the system lacks, add only that one, keep every existing token, value and component unchanged, bump the version with a history entry, and note the addition in system.md. If the project has no identity, propose a system with 2 palette options, write it, and stop for review. Build every direction only with these tokens and components.`

/** The re-detect message's instruction: the sources are read again, and only what they changed is written. */
export const DESIGN_SYSTEM_REDETECT_INSTRUCTION = `Re-read the project's sources and compare them with the existing design/system files. Change only the tokens and components whose source changed, add ones that are new, keep every other token, value and component exactly as it is, bump the version with a history entry, and update the sources in tokens.json and system.md. If the files are missing, ${DERIVE_MISSING_SYSTEM}`

/** The two file contracts, briefly: what an agent writes and what MassOrca reads back. */
export const DESIGN_SYSTEM_FORMAT_INSTRUCTION = [
  'Design system file formats:',
  `${DESIGN_SYSTEM_TOKENS_PATH}: W3C design tokens. Groups color, type, space, radius, shadow and motion, each token {"$type"?, "$value": "<string>", "$description"?}; a type token may add "$extensions": {"massorca": {"weight": 600}}. The root "$extensions.massorca" holds {"version": <integer, 1 for a new system>, "status": "detected" | "proposed", "agent": "<your name>", "updatedAt": "YYYY-MM-DD", "history": [{"version": 1, "status": "detected", "at": "YYYY-MM-DD"}], "sources": [{"path": "<file read>", "took": "<what was taken from it>"}], "palettes": [{"id": "A", "name": "<name>", "note": "<one line>", "swatches": ["#rrggbb"], "tokens": {"color.primary": "#rrggbb"}}]}; palettes only for a proposed system. A token's id is group.name and its CSS variable is --group-name.`,
  `${DESIGN_SYSTEM_COMPONENTS_PATH}: one <style> block plus one <section data-component="Name" data-variants="primary secondary" data-variant-options="primary secondary disabled hover" data-bind-background="color.primary" data-bind-radius="radius.md">...</section> per component. In the markup use var(--bind-<prop>) for a bound property and var(--<token css variable>) otherwise. No scripts and no external resources.`,
  `${DESIGN_SYSTEM_SOURCE_PATH}: the rules of the system and its sources, in prose.`
].join('\n')

/** Whether a request with this mode carries the design system instruction. */
export function usesDesignSystemInstruction(mode: PrototypeDesignSystemMode | undefined): boolean {
  return mode !== undefined && mode !== 'skip' && PROTOTYPE_DESIGN_SYSTEM_MODES.includes(mode)
}

/** The lines a prototype request adds after its direction instruction for "Use it" or "Propose one first". */
export function designSystemRequestInstruction(): string {
  return `${DESIGN_SYSTEM_READ_INSTRUCTION}\n${DESIGN_SYSTEM_FORMAT_INSTRUCTION}`
}
