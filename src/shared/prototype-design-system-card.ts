// What the design system card of a prototype request shows, from the chat's project as the host read it: the
// system's version, token count, source names and the request card's four swatches, or that the project has
// none. Pure, so the card's rules are tested without the screen.
import { DESIGN_SYSTEM_TOKENS_PATH } from './prototype-design-system-files'
import {
  designSystemRequestSwatches,
  summarizeDesignSystem
} from './prototype-design-system-summary'
import { parseDesignTokens, type DesignSystemSource } from './prototype-design-system-tokens'

export type PrototypeSystemCard =
  | {
      kind: 'existing'
      projectKey: string
      projectName: string
      version: number
      tokenCount: number
      /** The file names of the sources the system was read from, without their folders. */
      sourceNames: string[]
      /** Primary, foreground, muted and success colors, in the request card's order. */
      swatches: string[]
    }
  | { kind: 'none'; projectKey: string; projectName: string }

/** The project's read files as the host answered them, with the tokens file's status. */
export type PrototypeSystemRead = {
  projectKey: string
  projectName: string
  tokensJson?: string
  unreadableFileNames?: readonly string[]
}

/**
 * The card for a project's system: "none" when the project has no tokens file, "existing" for a system that
 * parses (proposed or detected alike), and null when the system cannot be shown, because its tokens file is
 * there but unreadable or unparseable. A null card sends the request as it did before the card existed.
 */
export function prototypeSystemCardOf(read: PrototypeSystemRead): PrototypeSystemCard | null {
  const { projectKey, projectName } = read
  if (read.unreadableFileNames?.includes(DESIGN_SYSTEM_TOKENS_PATH)) {
    return null
  }
  if (read.tokensJson === undefined) {
    return { kind: 'none', projectKey, projectName }
  }
  const parsed = parseDesignTokens(read.tokensJson)
  if (parsed === null) {
    return null
  }
  const summary = summarizeDesignSystem(parsed)
  return {
    kind: 'existing',
    projectKey,
    projectName,
    version: summary.version,
    tokenCount: summary.tokenCount,
    sourceNames: sourceNamesOf(parsed.meta.sources),
    swatches: designSystemRequestSwatches(parsed.tokens)
  }
}

/** The file name of each source, without its folders: `src/assets/main.css` names `main.css`. */
export function sourceNamesOf(sources: readonly DesignSystemSource[]): string[] {
  return sources.map((source) => {
    const segments = source.path.split(/[\\/]/u).filter((segment) => segment.length > 0)
    return segments.at(-1) ?? source.path
  })
}

/** "A, B and C" for three names: the last two joined by `conjunction`; one name, or none, stands alone. */
export function joinNames(names: readonly string[], conjunction: string): string {
  if (names.length < 2) {
    return names.join('')
  }
  return `${names.slice(0, -1).join(', ')} ${conjunction} ${names.at(-1)}`
}
