// The caps and the CSS allowlist shared by the annotate host and its frame validator. No logic here.
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
