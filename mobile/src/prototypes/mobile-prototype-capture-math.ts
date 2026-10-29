import type { NativeChatVisualRect } from '../../../src/shared/native-chat-visual-annotate'

/** What a capture of one pin comes to: the PNG, or nothing. A failure only drops that screenshot. */
export type MobilePrototypeCapture = { ok: true; pngBase64: string } | { ok: false }

/** What a send needs of the frame on screen: the page's size, and a picture of one element of it. */
export type MobilePrototypeFrameHandle = {
  pageSize: { width: number; height: number }
  capturePin: (rect: NativeChatVisualRect) => Promise<MobilePrototypeCapture>
}

export type MobilePrototypeCropRegion = {
  originX: number
  originY: number
  width: number
  height: number
}

/** Pins are cropped to this width at most, so a large element still fits the host's upload cap. */
export const PROTOTYPE_CAPTURE_MAX_WIDTH_PX = 1200

/**
 * Where a pin sits in the picture of the frame. The pin's rectangle is in the page's own pixels; the
 * frame is drawn scaled down to fit the screen, and the picture has `pixelRatio` pixels per screen
 * point. A rectangle with nothing of it inside the frame has no region.
 */
export function prototypeCaptureCrop(input: {
  rect: NativeChatVisualRect
  /** Screen points per page pixel. */
  scale: number
  pixelRatio: number
  /** The frame's size on screen, in points. */
  frame: { width: number; height: number }
}): MobilePrototypeCropRegion | null {
  const { rect, scale, pixelRatio, frame } = input
  const factor = scale * pixelRatio
  const imageWidth = Math.round(frame.width * pixelRatio)
  const imageHeight = Math.round(frame.height * pixelRatio)
  const left = Math.max(0, Math.floor(rect.x * factor))
  const top = Math.max(0, Math.floor(rect.y * factor))
  const right = Math.min(imageWidth, Math.ceil((rect.x + rect.width) * factor))
  const bottom = Math.min(imageHeight, Math.ceil((rect.y + rect.height) * factor))
  if (!(right > left && bottom > top)) {
    return null
  }
  return { originX: left, originY: top, width: right - left, height: bottom - top }
}
