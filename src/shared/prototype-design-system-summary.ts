// The short facts about a design system that a list row or a request card shows.
import type {
  DesignSystemStatus,
  DesignToken,
  ParsedDesignTokens
} from './prototype-design-system-tokens'

const SWATCH_COUNT = 4
/** The longest color value a list swatch carries; the list contract refuses a longer one. */
export const DESIGN_SYSTEM_SWATCH_MAX_LENGTH = 64
const LIST_SWATCH_IDS = ['color.primary', 'color.border', 'color.muted', 'color.success'] as const
const REQUEST_SWATCH_IDS = [
  'color.primary',
  'color.foreground',
  'color.muted',
  'color.success'
] as const

export type DesignSystemSummary = {
  status: DesignSystemStatus
  version: number
  tokenCount: number
  agent?: string
  /** Color values for the list icon. */
  swatches: string[]
}

/** The values for the list row icon: primary, border, muted, success. */
export function designSystemListSwatches(tokens: readonly DesignToken[]): string[] {
  return pickSwatches(tokens, LIST_SWATCH_IDS)
}

/** The values for the request card: primary, foreground, muted, success. */
export function designSystemRequestSwatches(tokens: readonly DesignToken[]): string[] {
  return pickSwatches(tokens, REQUEST_SWATCH_IDS)
}

// A wanted color that the system lacks, or whose value is too long for a swatch, is replaced by the next color
// token not already shown.
function pickSwatches(tokens: readonly DesignToken[], wanted: readonly string[]): string[] {
  const colors = tokens.filter(
    (token) => token.group === 'color' && token.value.length <= DESIGN_SYSTEM_SWATCH_MAX_LENGTH
  )
  const byId = new Map(colors.map((token) => [token.id, token]))
  const chosen = wanted.flatMap((id) => byId.get(id) ?? [])
  const used = new Set(chosen.map((token) => token.id))
  const fillers = colors
    .filter((token) => !used.has(token.id))
    .slice(0, SWATCH_COUNT - chosen.length)
  return [...chosen, ...fillers].map((token) => token.value)
}

/** The summary of a parsed tokens.json; an absent version reads as 1 and an absent status as detected. */
export function summarizeDesignSystem(parsed: ParsedDesignTokens): DesignSystemSummary {
  const { meta, tokens } = parsed
  return {
    status: meta.status ?? 'detected',
    version: meta.version ?? 1,
    tokenCount: tokens.length,
    ...(meta.agent !== undefined ? { agent: meta.agent } : {}),
    swatches: designSystemListSwatches(tokens)
  }
}
