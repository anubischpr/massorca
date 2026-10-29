import type { PrototypeViewport } from '../../../src/shared/prototype-set-state'

/** The page's width in CSS pixels by viewport, as the desktop frame lays it out. */
export const PROTOTYPE_DESIGN_WIDTH: Readonly<Record<PrototypeViewport, number>> = {
  desktop: 640,
  phone: 360
}

export type PrototypeFrameLayout = {
  /** The page's own size: it lays out at this width and fills the frame's height once scaled. */
  designWidth: number
  designHeight: number
  scale: number
  /** The frame as drawn on screen. */
  boxWidth: number
  boxHeight: number
}

/** A page wider than the screen shrinks to fit it; a narrower one keeps its size. */
export function prototypeFrameLayout(
  viewport: PrototypeViewport,
  available: { width: number; height: number }
): PrototypeFrameLayout | null {
  if (available.width <= 0 || available.height <= 0) {
    return null
  }
  const designWidth = PROTOTYPE_DESIGN_WIDTH[viewport]
  const scale = Math.min(1, available.width / designWidth)
  return {
    designWidth,
    designHeight: available.height / scale,
    scale,
    boxWidth: designWidth * scale,
    boxHeight: available.height
  }
}
