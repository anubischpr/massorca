// How many design directions a prototype request asks for: the setting, its sanitizer, and the
// prompt line that asks for them.

export const PROTOTYPE_COUNT_MIN = 1
export const PROTOTYPE_COUNT_MAX = 4
export const PROTOTYPE_COUNT_DEFAULT = 2

export type PrototypeCountSetting = {
  mode: 'always' | 'ask'
  count: number
}

export const DEFAULT_PROTOTYPE_COUNT_SETTING: PrototypeCountSetting = {
  mode: 'always',
  count: PROTOTYPE_COUNT_DEFAULT
}

/** Rounds to the nearest integer within 1..4; a non-finite number gets the default. */
export function clampPrototypeCount(count: number): number {
  if (!Number.isFinite(count)) {
    return PROTOTYPE_COUNT_DEFAULT
  }
  return Math.min(PROTOTYPE_COUNT_MAX, Math.max(PROTOTYPE_COUNT_MIN, Math.round(count)))
}

/** Turns unknown input into a valid setting; each field falls back to its own default. */
export function sanitizePrototypeCountSetting(input: unknown): PrototypeCountSetting {
  if (typeof input !== 'object' || input === null) {
    return { ...DEFAULT_PROTOTYPE_COUNT_SETTING }
  }
  const mode =
    'mode' in input && isPrototypeCountMode(input.mode)
      ? input.mode
      : DEFAULT_PROTOTYPE_COUNT_SETTING.mode
  const count =
    'count' in input && typeof input.count === 'number'
      ? clampPrototypeCount(input.count)
      : DEFAULT_PROTOTYPE_COUNT_SETTING.count
  return { mode, count }
}

function isPrototypeCountMode(value: unknown): value is PrototypeCountSetting['mode'] {
  return value === 'always' || value === 'ask'
}

export function buildPrototypeCountLine(count: number): string {
  const directions = clampPrototypeCount(count)
  if (directions === 1) {
    return 'Produce 1 design direction, as a self-contained HTML file, with a one-line tradeoff.'
  }
  return `Produce ${directions} distinct design directions, each a self-contained HTML file, with a one-line tradeoff.`
}
