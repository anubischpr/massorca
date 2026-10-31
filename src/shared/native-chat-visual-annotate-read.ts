// Host-side reads of what the annotate frame sends: a picked element, its design and trail. Each read is
// validated and bounded, and a malformed one reads as null, so the whole message is dropped.
import type { PrototypeElementState, PrototypeSize } from './prototype-draft'
import type {
  NativeChatVisualDesignKind,
  NativeChatVisualDesignReadout,
  NativeChatVisualPickedElement,
  NativeChatVisualRect,
  NativeChatVisualTrailItem
} from './native-chat-visual-annotate'
import { NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS } from './native-chat-visual-annotate-limits'

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

// Null for a readout outside the documented shape, so the pick is dropped whole.
export function readDesign(value: unknown): NativeChatVisualDesignReadout | null {
  if (!isRecord(value)) {
    return null
  }
  const limits = NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS
  const kind = designKindOf(value.kind)
  const align = designAlignOf(value.align)
  const { fill, color, border, shadow, fontFamily, bold, italic, underline } = value
  const borderWidth = lengthOf(value.borderWidth)
  const radius = lengthOf(value.radius)
  const padding = lengthOf(value.padding)
  const gap = lengthOf(value.gap)
  const lineHeight = lengthOf(value.lineHeight)
  const fontSize = value.fontSize
  const width = readSize(value.width)
  const height = readSize(value.height)
  if (
    kind === null ||
    align === null ||
    !isFillColor(fill) ||
    !isHexColor(color) ||
    !isFillColor(border) ||
    !isBoundedString(shadow, limits.shadow, 0) ||
    !isBoundedString(fontFamily, limits.family, 0) ||
    typeof bold !== 'boolean' ||
    typeof italic !== 'boolean' ||
    typeof underline !== 'boolean' ||
    borderWidth === null ||
    radius === null ||
    padding === null ||
    gap === null ||
    lineHeight === null ||
    !isFiniteNumber(fontSize) ||
    fontSize < 0 ||
    fontSize > limits.fontSize ||
    !width ||
    !height
  ) {
    return null
  }
  return {
    kind,
    fill,
    color,
    border,
    borderWidth,
    radius,
    shadow,
    width,
    height,
    padding,
    gap,
    fontFamily,
    fontSize,
    lineHeight,
    bold,
    italic,
    underline,
    align
  }
}

function designKindOf(value: unknown): NativeChatVisualDesignKind | null {
  switch (value) {
    case 'button':
      return 'button'
    case 'badge':
      return 'badge'
    case 'box':
      return 'box'
    case 'text':
      return 'text'
    default:
      return null
  }
}

function designAlignOf(value: unknown): NativeChatVisualDesignReadout['align'] | null {
  switch (value) {
    case 'left':
      return 'left'
    case 'center':
      return 'center'
    case 'right':
      return 'right'
    case 'justify':
      return 'justify'
    default:
      return null
  }
}

// A length in CSS pixels within the cap, or null.
function lengthOf(value: unknown): number | null {
  return isFiniteNumber(value) && value >= 0 && value <= NATIVE_CHAT_VISUAL_ANNOTATE_LIMITS.px
    ? value
    : null
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
