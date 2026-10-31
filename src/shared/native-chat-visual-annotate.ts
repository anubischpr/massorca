import type { PrototypeElementState, PrototypeSize } from './prototype-draft'
import { NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS } from './native-chat-visual-annotate-limits'
import {
  isBoundedString,
  isFiniteNumber,
  isRecord,
  readDesign,
  readPickedElement
} from './native-chat-visual-annotate-read'

export {
  NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS,
  NATIVE_CHAT_VISUAL_CSS_PROPERTIES,
  NATIVE_CHAT_VISUAL_CSS_VALUE_PATTERN
} from './native-chat-visual-annotate-limits'

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
/** The host asks the frame for its natural width and section readout; the frame answers with the natural type. */
export const NATIVE_CHAT_VISUAL_MEASURE_TYPE = 'orca-visual-measure'
export const NATIVE_CHAT_VISUAL_NATURAL_TYPE = 'orca-visual-natural'

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

export type NativeChatVisualNatural = {
  /** The widest the document lays out at: its body at max-content, in CSS pixels. */
  width: number
  /** The section's own design, when the document has one. */
  root?: NativeChatVisualDesignReadout
}

export function nativeChatVisualMeasureMessage(channel: string): {
  type: string
  channel: string
} {
  return { type: NATIVE_CHAT_VISUAL_MEASURE_TYPE, channel }
}

/** A frame's answer to a measure request on `channel`, validated; null for anything else. */
export function readNativeChatVisualNatural(
  data: unknown,
  channel: string
): NativeChatVisualNatural | null {
  if (
    !isRecord(data) ||
    data.channel !== channel ||
    data.type !== NATIVE_CHAT_VISUAL_NATURAL_TYPE
  ) {
    return null
  }
  const width = data.width
  if (!isFiniteNumber(width) || width < 0 || width > NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.px) {
    return null
  }
  if (data.root === undefined) {
    return { width }
  }
  const root = readDesign(data.root)
  return root === null ? null : { width, root }
}
