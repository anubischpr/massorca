// The ranges a prototype's Edit numbers take, and how a number typed into one is kept in its range.
import type { PrototypeSize } from './prototype-draft'

/** The range an Edit number may take; a value typed past it is pinned to the nearest bound. */
export type NumberBounds = { readonly min: number; readonly max: number }

/** A px size, a percentage and a font size each keep to their own range. */
export const SIZE_PX_BOUNDS: NumberBounds = { min: 0, max: 4000 }
export const SIZE_PERCENT_BOUNDS: NumberBounds = { min: 0, max: 100 }
export const FONT_SIZE_BOUNDS: NumberBounds = { min: 1, max: 200 }

/** The range of a Width or Height number in its unit; `auto` keeps the px range it is stored with. */
export function sizeBoundsOf(unit: PrototypeSize['unit']): NumberBounds {
  return unit === '%' ? SIZE_PERCENT_BOUNDS : SIZE_PX_BOUNDS
}

export function clampToBounds(value: number, bounds: NumberBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, value))
}

/** A number the user typed, pinned into its range; null while it is not one yet (empty, a lone sign). */
export function parseNumberInput(text: string, bounds: NumberBounds): number | null {
  if (text.trim() === '') {
    return null
  }
  const value = Number(text)
  return Number.isFinite(value) ? clampToBounds(value, bounds) : null
}
