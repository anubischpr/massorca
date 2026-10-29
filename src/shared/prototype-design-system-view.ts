// What the Design system view shows, derived from one system's tokens and components: which sections have
// tokens, the sample text and bar widths, how many components and sets use a token, and the parts of its
// header, source line and palette summary. Pure, so each rule is tested without the screen.
import type { ComponentSection } from './prototype-design-system-components'
import type {
  DesignSystemHistoryEntry,
  DesignSystemMeta,
  DesignToken
} from './prototype-design-system-tokens'
import type { PrototypeListedSet } from './rpc-contract/prototype-params'

const FONT_FAMILY_TYPE = 'fontFamily'
/** The bar of a space token is drawn four pixels per unit. */
const SPACING_BAR_PIXELS_PER_UNIT = 4
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u
const NUMBER_PATTERN = /^\d+(?:\.\d+)?(?:px)?$/u

export type DesignSystemSections = {
  color: DesignToken[]
  /** Every type token, the font family included. */
  type: DesignToken[]
  /** The type tokens a scale shows: every type token but the font family. */
  typeScale: DesignToken[]
  /** The value of the font family token (W3C `$type` "fontFamily"), when the system has one. */
  fontFamily: string | null
  space: DesignToken[]
  radius: DesignToken[]
  shadow: DesignToken[]
  motion: DesignToken[]
}

/** The tokens of each section. A section with no token is hidden by the screen. */
export function designSystemSectionsOf(tokens: readonly DesignToken[]): DesignSystemSections {
  const type = tokens.filter((token) => token.group === 'type')
  return {
    color: tokensOfGroup(tokens, 'color'),
    type,
    typeScale: type.filter((token) => !isFontFamily(token)),
    fontFamily: type.find(isFontFamily)?.value ?? null,
    space: tokensOfGroup(tokens, 'space'),
    radius: tokensOfGroup(tokens, 'radius'),
    shadow: tokensOfGroup(tokens, 'shadow'),
    motion: tokensOfGroup(tokens, 'motion')
  }
}

function tokensOfGroup(tokens: readonly DesignToken[], group: string): DesignToken[] {
  return tokens.filter((token) => token.group === group)
}

function isFontFamily(token: DesignToken): boolean {
  return token.group === 'type' && token.type === FONT_FAMILY_TYPE
}

/** The text a type token is shown in: its description, else its name with a capital letter. */
export function sampleTextOf(token: DesignToken): string {
  const description = token.description?.trim() ?? ''
  if (description.length > 0) {
    return description
  }
  return token.name.charAt(0).toUpperCase() + token.name.slice(1)
}

/** The width of a space token's bar in pixels; zero for a value that holds no number. */
export function spacingBarPixels(value: string): number {
  const units = Number.parseFloat(value)
  return Number.isFinite(units) ? units * SPACING_BAR_PIXELS_PER_UNIT : 0
}

/** The group a bound token belongs to; a binding offers the tokens of its group. */
export function tokenGroupOf(tokenId: string): string {
  return tokenId.split('.')[0] ?? ''
}

/** How many components bind one of their properties to this token. */
export function componentsUsingToken(
  tokenId: string,
  components: readonly ComponentSection[]
): number {
  return components.filter((section) => Object.values(section.bindings).includes(tokenId)).length
}

/** The sets of a project that a rebuild offers: built on the system's current version, with a folder on the host. */
export function setsBuiltOn(
  sets: readonly PrototypeListedSet[],
  projectKey: string,
  version: number
): PrototypeListedSet[] {
  return sets.filter(
    (set) =>
      set.projectKey === projectKey && set.builtOn === version && set.folderPath !== undefined
  )
}

/** The chat a design system message goes to: the project's newest set, which the list keeps first. */
export function designSystemTargetSet(
  sets: readonly PrototypeListedSet[],
  projectKey: string
): PrototypeListedSet | undefined {
  return sets.find((set) => set.projectKey === projectKey)
}

/** The version a history entry was before the current one: the newest entry older than `version`. */
export function previousVersionOf(
  history: readonly DesignSystemHistoryEntry[],
  version: number
): DesignSystemHistoryEntry | null {
  let previous: DesignSystemHistoryEntry | null = null
  for (const entry of history) {
    if (entry.version < version && (previous === null || entry.version > previous.version)) {
      previous = entry
    }
  }
  return previous
}

/** A day of a system's dates as "21 Oct" in the locale; null when the text is not a calendar date. */
export function designSystemDayLabel(isoDate: string | undefined, locale: string): string | null {
  if (isoDate === undefined || !DATE_PATTERN.test(isoDate)) {
    return null
  }
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(date)
}

export type PaletteTypeParts = {
  fontFamily: string | null
  /** The numbers of the type scale, in file order, without their px unit. */
  sizes: string[]
  /** The medium radius without its px unit; null when the system has none. */
  radius: string | null
  /** The first space token without its px unit; null when the system has none. */
  spacingBase: string | null
}

/** The type, radius and spacing a palette review summarizes, read from the system's tokens. */
export function paletteTypeParts(sections: DesignSystemSections): PaletteTypeParts {
  return {
    fontFamily: sections.fontFamily,
    sizes: sections.typeScale.filter((token) => NUMBER_PATTERN.test(token.value)).map(withoutPx),
    radius: tokenValueOf(sections.radius, 'md'),
    spacingBase: tokenValueOf(sections.space, '1')
  }
}

function tokenValueOf(tokens: readonly DesignToken[], name: string): string | null {
  const token = tokens.find((candidate) => candidate.name === name)
  return token !== undefined && NUMBER_PATTERN.test(token.value) ? withoutPx(token) : null
}

function withoutPx(token: DesignToken): string {
  return token.value.replace(/px$/u, '')
}

/** How many sources the system was detected from; the header counts them. */
export function sourceCountOf(meta: DesignSystemMeta): number {
  return meta.sources.length
}

/** The present parts joined by a separator: a missing or empty part is left out, never shown as a gap. */
export function joinParts(
  parts: readonly (string | null | undefined)[],
  separator = ' · '
): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(separator)
}
