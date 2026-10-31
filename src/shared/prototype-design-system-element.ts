// One element of a component as the Components tab edits it: the rows its kind offers, its locator inside the
// component, what its original values bind to, and the CSS a draft edit becomes in the preview.
import type { PrototypeSize } from './prototype-draft'
import type {
  NativeChatVisualDesignKind,
  NativeChatVisualDesignReadout
} from './native-chat-visual-annotate'
import { designTokenCssVar, type DesignToken } from './prototype-design-system-tokens'

/** The locator of the component's own section: an element selector never reads as a dot. */
export const DESIGN_ELEMENT_ROOT = '.'

export type DesignElementKind = 'root' | NativeChatVisualDesignKind
export type DesignAlign = 'left' | 'center' | 'right' | 'justify'

/** The edited values of one element. A token id, or a raw hex or px string, for the token-bound rows. */
export type DesignElementEdit = {
  fill?: string
  color?: string
  border?: string
  borderWidth?: number
  radius?: string
  shadow?: string
  width?: PrototypeSize
  height?: PrototypeSize
  padding?: number
  gap?: number
  font?: string
  fontSize?: number
  lineHeight?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: DesignAlign
}

export type DesignElementProp = keyof DesignElementEdit

/** A row of the aside: one property, or the B/I/U group that edits three flags together. */
export type DesignRow =
  | 'fill'
  | 'color'
  | 'border'
  | 'borderWidth'
  | 'radius'
  | 'shadow'
  | 'width'
  | 'height'
  | 'padding'
  | 'gap'
  | 'font'
  | 'fontSize'
  | 'lineHeight'
  | 'style'
  | 'align'

export type DesignRowGroup = { heading: string; rows: readonly DesignRow[] }

/** The rows each kind offers, grouped as the aside shows them: a card and a label never share a list. */
export const DESIGN_ELEMENT_ROWS: Readonly<Record<DesignElementKind, readonly DesignRowGroup[]>> = {
  root: [{ heading: 'Layout', rows: ['gap', 'padding'] }],
  button: [
    { heading: 'Color', rows: ['fill', 'color', 'border'] },
    { heading: 'Shape', rows: ['radius', 'borderWidth', 'shadow'] },
    { heading: 'Size', rows: ['width', 'height', 'padding'] },
    { heading: 'Text', rows: ['font', 'fontSize', 'style', 'align'] }
  ],
  badge: [
    { heading: 'Color', rows: ['fill', 'color', 'border'] },
    { heading: 'Shape', rows: ['radius', 'borderWidth'] },
    { heading: 'Size', rows: ['padding'] },
    { heading: 'Text', rows: ['font', 'fontSize', 'style'] }
  ],
  box: [
    { heading: 'Color', rows: ['fill', 'border'] },
    { heading: 'Shape', rows: ['radius', 'borderWidth', 'shadow'] },
    { heading: 'Size', rows: ['width', 'height', 'padding', 'gap'] }
  ],
  text: [
    { heading: 'Color', rows: ['color'] },
    { heading: 'Size', rows: ['width'] },
    { heading: 'Text', rows: ['font', 'fontSize', 'lineHeight', 'style', 'align'] }
  ]
}

/** The token group each token-bound row chooses from; a row not listed takes a number or a flag. */
const TOKEN_GROUP_OF_ROW: Partial<Record<DesignRow, string>> = {
  fill: 'color',
  color: 'color',
  border: 'color',
  radius: 'radius',
  shadow: 'shadow',
  font: 'type'
}

export function tokenGroupOfRow(row: DesignRow): string | null {
  return TOKEN_GROUP_OF_ROW[row] ?? null
}

/** The kind of a row's values: a token chip list, a number, a size with its unit, or a flag. */
export function isTokenRow(row: DesignRow): boolean {
  return tokenGroupOfRow(row) !== null
}

/**
 * The locator of an element from the selector the frame reports: the path below the component's section,
 * or the id-anchored path the frame chose when an id makes it unique. Null for any other selector.
 */
// Why: the frame reports its body as `body:nth-of-type(1)`, so the body may carry that index too.
const SECTION_PATH_PATTERN = /^html > body(?::nth-of-type\(\d+\))? > section(?::nth-of-type\(\d+\))?(?: > (.+))?$/u

export function elementLocatorOf(selector: string): string | null {
  if (selector.startsWith('#')) {
    return selector
  }
  const match = SECTION_PATH_PATTERN.exec(selector)
  return match === null ? null : (match[1] ?? DESIGN_ELEMENT_ROOT)
}

/** The selector that finds a locator's element in the preview document. */
export function elementSelectorOf(locator: string): string {
  if (locator === DESIGN_ELEMENT_ROOT) {
    return 'html > body > section:nth-of-type(1)'
  }
  return locator.startsWith('#') ? locator : `html > body > section:nth-of-type(1) > ${locator}`
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/u
const PX_PATTERN = /^\d+(?:\.\d+)?px$/u

/** A 6-digit hex of a color token value, read from `#rgb`, `#rrggbb` or an opaque `rgb()`; null otherwise. */
export function colorHexOf(text: string): string | null {
  const value = text.trim().toLowerCase()
  if (/^#[0-9a-f]{3}$/u.test(value)) {
    return `#${value
      .slice(1)
      .split('')
      .map((digit) => `${digit}${digit}`)
      .join('')}`
  }
  if (HEX_PATTERN.test(value)) {
    return value
  }
  const rgb =
    /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+(?:1|1\.0+|100%))?\s*\)$/u.exec(
      value
    )
  if (rgb === null) {
    return value === 'transparent' ? 'transparent' : null
  }
  return `#${rgb
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

/** The token of the row's group whose value is the original, or null when no token of the group matches. */
export function boundTokenOf(
  row: DesignRow,
  readout: NativeChatVisualDesignReadout,
  tokens: readonly DesignToken[]
): string | null {
  const group = tokenGroupOfRow(row)
  if (group === null) {
    return null
  }
  const matches = (token: DesignToken): boolean => {
    if (token.group !== group) {
      return false
    }
    if (row === 'fill') {
      return colorHexOf(token.value) === readout.fill
    }
    if (row === 'color') {
      return colorHexOf(token.value) === readout.color
    }
    if (row === 'border') {
      return colorHexOf(token.value) === readout.border
    }
    if (row === 'radius') {
      return (
        PX_PATTERN.test(token.value.trim()) && Number.parseFloat(token.value) === readout.radius
      )
    }
    if (row === 'font') {
      return normalizeFamily(token.value) === normalizeFamily(readout.fontFamily)
    }
    return token.value.trim() === readout.shadow
  }
  return tokens.find(matches)?.id ?? null
}

function normalizeFamily(text: string): string {
  return text.replaceAll(/["']/gu, '').replaceAll(/\s+/gu, '').toLowerCase()
}

/** The rows that bind to a token, or to a raw color, px or family when no token of their group holds the value. */
export type TokenRow = 'fill' | 'color' | 'border' | 'radius' | 'shadow' | 'font'

/** The value a token row shows with no draft edit: the bound token id, else the raw value. */
export function originalTokenValueOf(
  row: TokenRow,
  readout: NativeChatVisualDesignReadout,
  tokens: readonly DesignToken[]
): string {
  const bound = boundTokenOf(row, readout, tokens)
  if (bound !== null) {
    return bound
  }
  return rawTokenValueOf(row, readout)
}

function rawTokenValueOf(row: TokenRow, readout: NativeChatVisualDesignReadout): string {
  if (row === 'fill') {
    return readout.fill
  }
  if (row === 'color') {
    return readout.color
  }
  if (row === 'border') {
    return readout.border
  }
  if (row === 'radius') {
    return `${readout.radius}px`
  }
  return row === 'shadow' ? readout.shadow : readout.fontFamily
}

/** The text a draft item shows for one edited value. */
export function designElementValueText(prop: string, value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'on' : 'off'
  }
  if (typeof value === 'number') {
    return prop === 'lineHeight' ? String(value) : `${value}px`
  }
  if (isPrototypeSize(value)) {
    return value.unit === 'auto' ? 'auto' : `${value.value}${value.unit}`
  }
  return typeof value === 'string' ? value : ''
}

/** Two draft values are the same when the primitive or the size is: a value back at its original drops out. */
export function sameDesignValue(left: unknown, right: unknown): boolean {
  if (isPrototypeSize(left) && isPrototypeSize(right)) {
    return left.value === right.value && left.unit === right.unit
  }
  return left === right
}

function isPrototypeSize(value: unknown): value is PrototypeSize {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof value.value === 'number' &&
    'unit' in value &&
    (value.unit === 'px' || value.unit === '%' || value.unit === 'auto')
  )
}

/** The CSS an edited value writes, with a token id as its variable; null for a value that resolves to nothing. */
function cssOf(value: string, tokens: ReadonlySet<string>): string | null {
  if (HEX_PATTERN.test(value) || PX_PATTERN.test(value)) {
    return value
  }
  return tokens.has(value) ? `var(${designTokenCssVar(value)})` : null
}

/**
 * The inline declarations that apply an element's edits in the preview, as the frame's allowlisted
 * properties. A value that cannot be written as CSS is dropped, never guessed.
 */
export function designElementCss(
  edits: DesignElementEdit,
  tokens: readonly DesignToken[]
): Record<string, string> {
  const known = new Set(tokens.map((token) => token.id))
  const css: Record<string, string> = {}
  const paint = (property: string, value: string | undefined): void => {
    const resolved = value === undefined ? null : cssOf(value, known)
    if (resolved !== null) {
      css[property] = resolved
    }
  }
  paint('background-color', edits.fill)
  paint('color', edits.color)
  paint('border-color', edits.border)
  paint('border-radius', edits.radius)
  paint('box-shadow', edits.shadow)
  paint('font-family', edits.font)
  if (edits.borderWidth !== undefined) {
    css['border-width'] = `${edits.borderWidth}px`
    css['border-style'] = edits.borderWidth > 0 ? 'solid' : 'none'
  }
  for (const [property, size] of [
    ['width', edits.width],
    ['height', edits.height]
  ] as const) {
    if (size !== undefined) {
      css[property] = size.unit === 'auto' ? 'auto' : `${size.value}${size.unit}`
    }
  }
  if (edits.padding !== undefined) {
    css.padding = `${edits.padding}px`
  }
  if (edits.gap !== undefined) {
    css.gap = `${edits.gap}px`
  }
  if (edits.fontSize !== undefined) {
    css['font-size'] = `${edits.fontSize}px`
  }
  if (edits.lineHeight !== undefined) {
    css['line-height'] = String(edits.lineHeight)
  }
  if (edits.bold !== undefined) {
    css['font-weight'] = edits.bold ? '700' : '400'
  }
  if (edits.italic !== undefined) {
    css['font-style'] = edits.italic ? 'italic' : 'normal'
  }
  if (edits.underline !== undefined) {
    css['text-decoration-line'] = edits.underline ? 'underline' : 'none'
  }
  if (edits.align !== undefined) {
    css['text-align'] = edits.align
  }
  return css
}
