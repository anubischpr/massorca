import type { PrototypeViewport } from './prototype-set-state'

type PrototypeFrameSize = { width: number; height: number }

/** Each viewport's artboard in CSS pixels: a page is laid out at this size, then scaled to fit. */
export const PROTOTYPE_FRAMES: Readonly<Record<PrototypeViewport, PrototypeFrameSize>> = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 }
}

export type PrototypeFrameLayout = {
  /** The page's own size: it lays out at this size and, scaled, fills the box. */
  designWidth: number
  designHeight: number
  scale: number
  /** The frame as drawn on screen. */
  boxWidth: number
  boxHeight: number
}

/**
 * The artboard fitted to the space: shrunk to the width when the space is narrower, never enlarged.
 * A space shorter than the scaled artboard crops it, and the page scrolls inside the box.
 */
export function prototypeFrameLayout(
  viewport: PrototypeViewport,
  available: { width: number; height: number }
): PrototypeFrameLayout | null {
  if (available.width <= 0 || available.height <= 0) {
    return null
  }
  const frame = PROTOTYPE_FRAMES[viewport]
  const scale = Math.min(1, available.width / frame.width)
  const boxHeight = Math.min(available.height, frame.height * scale)
  return {
    designWidth: frame.width,
    designHeight: boxHeight / scale,
    scale,
    boxWidth: frame.width * scale,
    boxHeight
  }
}
