import type { PrototypeElementState, PrototypeSize } from './prototype-draft'

/**
 * The element-annotation channel of a chat visual, as the hosts see it. The host turns annotate mode
 * on, places numbered pins and applies live overrides; the frame reports a picked element or a pin
 * click. The frame's own copy of the validation lives in `native-chat-visual-annotate-script.ts`.
 */

export const NATIVE_CHAT_VISUAL_ANNOTATE_TYPE = 'orca-visual-annotate'
export const NATIVE_CHAT_VISUAL_PINS_TYPE = 'orca-visual-pins'
export const NATIVE_CHAT_VISUAL_OVERRIDES_TYPE = 'orca-visual-overrides'
export const NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE = 'orca-visual-element-picked'
export const NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE = 'orca-visual-pin-clicked'

/** Caps shared by the frame's validator and the hosts'. A command over a cap is dropped whole. */
export const NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS = {
  items: 200,
  selector: 512,
  pinKey: 128,
  pinNumber: 9999,
  text: 1000,
  label: 64,
  snippet: 600,
  px: 10000,
  fontSize: 400,
  trail: 12,
  family: 200,
  shadow: 300
} as const

/**
 * The style properties a host may set on an element through `css`. Each value must match
 * NATIVE_CHAT_VISUAL_CSS_VALUE_PATTERN; the frame checks both, and one bad declaration drops the command.
 */
export const NATIVE_CHAT_VISUAL_CSS_PROPERTIES = [
  'background-color',
  'color',
  'border-color',
  'border-width',
  'border-style',
  'border-radius',
  'box-shadow',
  'width',
  'height',
  'padding',
  'gap',
  'font-family',
  'font-size',
  'line-height',
  'font-weight',
  'font-style',
  'text-decoration-line',
  'text-align'
] as const

export const NATIVE_CHAT_VISUAL_CSS_VALUE_PATTERN =
  /^(#[0-9a-fA-F]{6}|var\(--[A-Za-z0-9_-]{1,80}\)|\d{1,5}(?:\.\d{1,3})?(?:px|%)?|auto|none|solid|italic|normal|underline|left|center|right|justify|transparent)$/u

export type NativeChatVisualPin = {
  pinKey: string
  number: number
  selector: string
  active: boolean
  /** False draws the outline only, with no numbered badge. Absent means a badge. */
  badge?: boolean
}

export type NativeChatVisualStyleOverride = {
  color?: string
  backgroundColor?: string
  width?: PrototypeSize
  height?: PrototypeSize
  fontSize?: number
  /** Allowlisted properties to values; see NATIVE_CHAT_VISUAL_CSS_PROPERTIES. */
  css?: Readonly<Record<string, string>>
}

/** A live preview on the element `selector` finds first; removing it restores the original. */
export type NativeChatVisualOverride = {
  selector: string
  text?: string
  style?: NativeChatVisualStyleOverride
}

export type NativeChatVisualAnnotateState = {
  enabled: boolean
  pins: readonly NativeChatVisualPin[]
  overrides: readonly NativeChatVisualOverride[]
}

export type NativeChatVisualRect = {
  x: number
  y: number
  width: number
  height: number
}

export type NativeChatVisualDesignKind = 'button' | 'badge' | 'box' | 'text'

/**
 * An element's own design as the frame reads it, with the frame's own overrides taken off. Colors are
 * 6-digit hex or 'transparent'; lengths are px.
 */
export type NativeChatVisualDesignReadout = {
  kind: NativeChatVisualDesignKind
  fill: string
  color: string
  border: string
  borderWidth: number
  radius: number
  shadow: string
  width: PrototypeSize
  height: PrototypeSize
  padding: number
  gap: number
  fontFamily: string
  fontSize: number
  lineHeight: number
  bold: boolean
  italic: boolean
  underline: boolean
  align: 'left' | 'center' | 'right' | 'justify'
}

/** An ancestor of the picked element, outermost first, with its own selector and readout. */
export type NativeChatVisualTrailItem = {
  selector: string
  label: string
  design: NativeChatVisualDesignReadout
}

export type NativeChatVisualPickedElement = {
  selector: string
  label: string
  /** Viewport CSS pixels of the frame, from `getBoundingClientRect`. */
  rect: NativeChatVisualRect
  htmlSnippet: string
  state: PrototypeElementState
  /** Absent when the frame sent none; present but malformed, the whole pick is dropped. */
  design?: NativeChatVisualDesignReadout
  trail?: readonly NativeChatVisualTrailItem[]
}

export type NativeChatVisualAnnotateEvent =
  | { kind: 'element-picked'; element: NativeChatVisualPickedElement }
  | { kind: 'pin-clicked'; pinKey: string }

export type NativeChatVisualAnnotateMessage =
  | { type: typeof NATIVE_CHAT_VISUAL_ANNOTATE_TYPE; channel: string; enabled: boolean }
  | {
      type: typeof NATIVE_CHAT_VISUAL_PINS_TYPE
      channel: string
      pins: readonly NativeChatVisualPin[]
    }
  | {
      type: typeof NATIVE_CHAT_VISUAL_OVERRIDES_TYPE
      channel: string
      overrides: readonly NativeChatVisualOverride[]
    }

/**
 * The three host-to-frame messages that carry the whole annotate state. Each one replaces the
 * frame's previous value, so resending the full state is idempotent.
 */
export function nativeChatVisualAnnotateMessages(
  state: NativeChatVisualAnnotateState,
  channel: string
): NativeChatVisualAnnotateMessage[] {
  return [
    { type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, channel, enabled: state.enabled },
    { type: NATIVE_CHAT_VISUAL_PINS_TYPE, channel, pins: state.pins },
    { type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE, channel, overrides: state.overrides }
  ]
}

/** A frame-to-host annotate message on `channel`, validated; null for anything else. */
export function readNativeChatVisualAnnotateEvent(
  data: unknown,
  channel: string
): NativeChatVisualAnnotateEvent | null {
  if (!isRecord(data) || data.channel !== channel) {
    return null
  }
  if (data.type === NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE) {
    const pinKey = data.pinKey
    return isBoundedString(pinKey, NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.pinKey, 1)
      ? { kind: 'pin-clicked', pinKey }
      : null
  }
  if (data.type === NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE) {
    const element = readPickedElement(data.element)
    return element ? { kind: 'element-picked', element } : null
  }
  return null
}

function readPickedElement(value: unknown): NativeChatVisualPickedElement | null {
  if (!isRecord(value)) {
    return null
  }
  const { selector, label, htmlSnippet } = value
  if (
    !isBoundedString(selector, NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.selector, 1) ||
    !isBoundedString(label, NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.label, 1) ||
    !isBoundedString(htmlSnippet, NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.snippet, 0)
  ) {
    return null
  }
  const rect = readRect(value.rect)
  const state = readElementState(value.state)
  if (!rect || !state) {
    return null
  }
  const design = value.design === undefined ? undefined : readDesign(value.design)
  const trail = value.trail === undefined ? undefined : readTrail(value.trail)
  if (design === null || trail === null) {
    return null
  }
  return {
    selector,
    label,
    rect,
    htmlSnippet,
    state,
    ...(design === undefined ? {} : { design }),
    ...(trail === undefined ? {} : { trail })
  }
}

const DESIGN_KINDS: readonly string[] = ['button', 'badge', 'box', 'text']
const DESIGN_ALIGNS: readonly string[] = ['left', 'center', 'right', 'justify']

// Null for a readout outside the documented shape, so the pick is dropped whole.
function readDesign(value: unknown): NativeChatVisualDesignReadout | null {
  if (!isRecord(value)) {
    return null
  }
  const limits = NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS
  const { kind, fill, color, border, shadow, fontFamily, align } = value
  if (
    typeof kind !== 'string' ||
    !DESIGN_KINDS.includes(kind) ||
    !isFillColor(fill) ||
    !isHexColor(color) ||
    !isFillColor(border) ||
    !isBoundedString(shadow, limits.shadow, 0) ||
    !isBoundedString(fontFamily, limits.family, 0) ||
    typeof align !== 'string' ||
    !DESIGN_ALIGNS.includes(align) ||
    typeof value.bold !== 'boolean' ||
    typeof value.italic !== 'boolean' ||
    typeof value.underline !== 'boolean'
  ) {
    return null
  }
  const lengths = [value.borderWidth, value.radius, value.padding, value.gap, value.lineHeight]
  const width = readSize(value.width)
  const height = readSize(value.height)
  const { fontSize } = value
  if (
    !lengths.every((length) => isFiniteNumber(length) && length >= 0 && length <= limits.px) ||
    !isFiniteNumber(fontSize) ||
    fontSize < 0 ||
    fontSize > limits.fontSize ||
    !width ||
    !height
  ) {
    return null
  }
  return {
    kind: kind as NativeChatVisualDesignKind,
    fill,
    color,
    border,
    borderWidth: value.borderWidth as number,
    radius: value.radius as number,
    shadow,
    width,
    height,
    padding: value.padding as number,
    gap: value.gap as number,
    fontFamily,
    fontSize,
    lineHeight: value.lineHeight as number,
    bold: value.bold,
    italic: value.italic,
    underline: value.underline,
    align: align as NativeChatVisualDesignReadout['align']
  }
}

// Null for a trail over its cap or with an item outside the documented shape.
function readTrail(value: unknown): readonly NativeChatVisualTrailItem[] | null {
  if (!Array.isArray(value) || value.length > NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.trail) {
    return null
  }
  const items: NativeChatVisualTrailItem[] = []
  for (const entry of value) {
    if (!isRecord(entry)) {
      return null
    }
    const { selector, label } = entry
    const design = readDesign(entry.design)
    if (
      !isBoundedString(selector, NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.selector, 1) ||
      !isBoundedString(label, NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.label, 1) ||
      design === null
    ) {
      return null
    }
    items.push({ selector, label, design })
  }
  return items
}

function readRect(value: unknown): NativeChatVisualRect | null {
  if (!isRecord(value)) {
    return null
  }
  const { x, y, width, height } = value
  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    width < 0 ||
    height < 0
  ) {
    return null
  }
  return { x, y, width, height }
}

function readElementState(value: unknown): PrototypeElementState | null {
  if (!isRecord(value)) {
    return null
  }
  const { text, color, bg, fontSize } = value
  if (
    !isBoundedString(text, NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.text, 0) ||
    !isHexColor(color) ||
    !isFillColor(bg) ||
    !isFiniteNumber(fontSize) ||
    fontSize < 0 ||
    fontSize > NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.fontSize
  ) {
    return null
  }
  const width = readSize(value.width)
  const height = readSize(value.height)
  return width && height ? { text, color, bg, width, height, fontSize } : null
}

function readSize(value: unknown): PrototypeSize | null {
  if (!isRecord(value)) {
    return null
  }
  const { unit } = value
  const amount = value.value
  if (!isFiniteNumber(amount)) {
    return null
  }
  if (unit === 'auto') {
    return { value: amount, unit: 'auto' }
  }
  if (
    (unit === 'px' || unit === '%') &&
    amount >= 0 &&
    amount <= NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.px
  ) {
    return { value: amount, unit }
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBoundedString(value: unknown, max: number, min: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

/** A fill is a hex color, or 'transparent' when no ancestor paints behind the element. */
function isFillColor(value: unknown): value is string {
  return value === 'transparent' || isHexColor(value)
}
