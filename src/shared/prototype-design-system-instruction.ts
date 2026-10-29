// The hidden instruction that tells an agent how to read, detect, propose and write a project's
// design system: the text a prototype request carries, and the format of the files it names.
import {
  DESIGN_SYSTEM_COMPONENTS_PATH,
  DESIGN_SYSTEM_SOURCE_PATH,
  DESIGN_SYSTEM_TOKENS_PATH,
  PROTOTYPE_DESIGN_SYSTEM_MODES,
  type PrototypeDesignSystemMode
} from './prototype-design-system-files'

/** Appended to every prototype request except "Skip", before the format of the files it names. */
export const DESIGN_SYSTEM_READ_INSTRUCTION =
  'Before designing, read design/system/tokens.json, components.html and system.md. If they are missing: derive tokens from the project (CSS variables, theme or Tailwind config, style guide docs, existing components), list each source, write the three files, and stop. If the project has no identity, propose a system with 2 palette options, write it, and stop for review. Build every direction only with these tokens and components.'

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
