// The Collage view's grid: six columns and 12 px gaps, with 4 px rows. A card spans the columns its natural
// width needs and the rows its height needs, so the dense flow fills the gaps. A narrow container takes full width.
export const COLLAGE_COLUMNS = 6
export const COLLAGE_GAP = 12
export const COLLAGE_ROW = 4
/** A card's own padding and border, both sides: what its frame does not fill. */
export const COLLAGE_CARD_CHROME = 26
const NARROW_CONTAINER = 480
const UNKNOWN_ROWS = 10

/** The columns a card spans; before its width is known it spans two, and in a narrow container all of them. */
export function collageColumnsOf(containerWidth: number, naturalWidth: number | null): number {
  if (containerWidth < NARROW_CONTAINER) {
    return COLLAGE_COLUMNS
  }
  if (naturalWidth === null || !Number.isFinite(naturalWidth)) {
    return 2
  }
  const column = (containerWidth - COLLAGE_GAP * (COLLAGE_COLUMNS - 1)) / COLLAGE_COLUMNS
  const needed = Math.ceil(
    (naturalWidth + COLLAGE_CARD_CHROME + COLLAGE_GAP) / (column + COLLAGE_GAP)
  )
  return Math.min(COLLAGE_COLUMNS, Math.max(2, needed))
}

/** The rows a card spans for its height; before the height is known it spans a fixed run of rows. */
export function collageRowsOf(height: number | null): number {
  if (height === null || !Number.isFinite(height)) {
    return UNKNOWN_ROWS
  }
  return Math.max(1, Math.ceil((height + COLLAGE_GAP) / (COLLAGE_ROW + COLLAGE_GAP)))
}
