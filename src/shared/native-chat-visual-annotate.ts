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
  fontSize: 400
} as const

export type NativeChatVisualPin = {
  pinKey: string
  number: number
  selector: string
  active: boolean
}

export type NativeChatVisualStyleOverride = {
  color?: string
  backgroundColor?: string
  width?: PrototypeSize
  height?: PrototypeSize
  fontSize?: number
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

export type NativeChatVisualPickedElement = {
  selector: string
  label: string
  /** Viewport CSS pixels of the frame, from `getBoundingClientRect`. */
  rect: NativeChatVisualRect
  htmlSnippet: string
  state: PrototypeElementState
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
  return rect && state ? { selector, label, rect, htmlSnippet, state } : null
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
    !isHexColor(bg) ||
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
