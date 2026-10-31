// Host-side reads of what the annotate frame sends: a picked element, its design and trail. Each read is
// validated and bounded, and a malformed one reads as null, so the whole message is dropped.
import type { PrototypeSize } from './prototype-draft'
import type {
  NativeChatVisualDesignKind,
  NativeChatVisualDesignReadout,
  NativeChatVisualPickedElement,
  NativeChatVisualRect,
  NativeChatVisualTrailItem
} from './native-chat-visual-annotate'
import { NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS } from './native-chat-visual-annotate-limits'
import type { PrototypeElementState } from './prototype-draft'

export function readPickedElement(value: unknown): NativeChatVisualPickedElement | null {
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
export function readDesign(value: unknown): NativeChatVisualDesignReadout | null {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isBoundedString(value: unknown, max: number, min: number): value is string {
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
