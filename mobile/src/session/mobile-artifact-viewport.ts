/** A vertical span on screen, in window pixels. */
export type ScreenSpan = { top: number; bottom: number }

/** How far past the visible list a thumbnail starts loading, so it is ready when scrolled into view. */
export const ARTIFACT_PRELOAD_MARGIN_PX = 240

/** Whether a tile reaches the visible list, or the preload margin around it. */
export function isSpanNearViewport(
  tile: ScreenSpan,
  viewport: ScreenSpan,
  margin: number = ARTIFACT_PRELOAD_MARGIN_PX
): boolean {
  return tile.bottom >= viewport.top - margin && tile.top <= viewport.bottom + margin
}
