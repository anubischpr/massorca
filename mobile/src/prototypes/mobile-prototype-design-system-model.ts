// What the mobile Design system screen shows, derived from one system's files and the draft: the header line, the
// Type · Space · Radius summary, the component rows and the change bar. Pure, so each rule is tested without the screen.
import type { ComponentSection } from '../../../src/shared/prototype-design-system-components'
import type { DesignSystemContent } from '../../../src/shared/prototype-design-system-content'
import {
  draftComponentState,
  type DesignSystemDraft
} from '../../../src/shared/prototype-design-system-draft'
import type { DesignToken } from '../../../src/shared/prototype-design-system-tokens'
import {
  designSystemSectionsOf,
  joinParts,
  tokenGroupOf
} from '../../../src/shared/prototype-design-system-view'

const SUMMARY_SEPARATOR = ' · '

/** "{project} · v{n} · {agent}": the parts the system has, in order. */
export function mobileDesignSystemSubtitle(
  projectName: string,
  version: number,
  agent: string | undefined
): string {
  return joinParts([projectName, `v${version}`, agent])
}

/** The three summary lines under "Type · Space · Radius"; a line with no token is left out. */
export function mobileTokenSummaryLines(tokens: readonly DesignToken[]): string[] {
  const sections = designSystemSectionsOf(tokens)
  const lines = [
    sections.typeScale.length === 0
      ? null
      : sections.typeScale
          .map(
            (token, index) =>
              `${index === 0 ? `type.${token.name} ` : `${token.name} `}${typeScaleOf(token)}`
          )
          .join(SUMMARY_SEPARATOR),
    sections.space.length === 0
      ? null
      : `space ${sections.space.map(withoutPx).join(SUMMARY_SEPARATOR)}`,
    sections.radius.length === 0
      ? null
      : `radius ${sections.radius.map((token) => `${token.name} ${withoutPx(token)}`).join(SUMMARY_SEPARATOR)}`
  ]
  return lines.filter((line): line is string => line !== null)
}

/** A type token as "32/600": its size, then its weight when it has one. */
function typeScaleOf(token: DesignToken): string {
  return token.weight === undefined ? withoutPx(token) : `${withoutPx(token)}/${token.weight}`
}

function withoutPx(token: DesignToken): string {
  return token.value.replace(/(?<=\d)px$/u, '')
}

/** What a component row says under its name: its variants, or that it is marked for removal. */
export function mobileComponentMeta(section: ComponentSection, draft: DesignSystemDraft): string {
  return draft.removed[section.name] === true
    ? 'marked for removal · in the draft'
    : draftComponentState(draft, section).variants.join(SUMMARY_SEPARATOR)
}

/** A binding's label in the component sheet: "Background token". */
export function mobileBindingLabel(prop: string): string {
  return `${prop.charAt(0).toUpperCase()}${prop.slice(1)} token`
}

/** The bindings the mobile Edit tab shows: the ones bound to a color token. */
export function mobileColorBindings(
  section: ComponentSection,
  draft: DesignSystemDraft
): { prop: string; boundTo: string }[] {
  const { bindings } = draftComponentState(draft, section)
  return Object.entries(section.bindings)
    .filter(([, tokenId]) => tokenGroupOf(tokenId) === 'color')
    .map(([prop, tokenId]) => ({ prop, boundTo: bindings[prop] ?? tokenId }))
}

/** The color tokens a binding can pick: every token of the color group. */
export function mobileColorTokens(content: DesignSystemContent): DesignToken[] {
  return content.tokens.filter((token) => token.group === 'color')
}
