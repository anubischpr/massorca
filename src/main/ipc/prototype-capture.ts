// Captures a rectangle of the calling window's page as a PNG, for a note on a prototype.
import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import {
  PROTOTYPE_CAPTURE_RECT_CHANNEL,
  type PrototypeCaptureRect,
  type PrototypeCaptureResult
} from '../../shared/prototype-capture-types'
import { PROTOTYPE_ATTACHMENT_MAX_BYTES } from '../../shared/rpc-contract/prototype-params'

// Why a bound: a note captures one part of a page, not the whole window.
const MAX_CAPTURE_SIDE = 4000

/** The part of a window's web contents this handler uses. */
type CaptureSource = {
  capturePage: (
    rect: PrototypeCaptureRect
  ) => Promise<{ isEmpty: () => boolean; toPNG: () => Buffer }>
}

const CaptureRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
})

export function registerPrototypeCaptureHandlers(): void {
  ipcMain.handle(PROTOTYPE_CAPTURE_RECT_CHANNEL, (event: IpcMainInvokeEvent, rect: unknown) =>
    captureRect(event.sender, rect)
  )
}

async function captureRect(source: CaptureSource, rect: unknown): Promise<PrototypeCaptureResult> {
  const bounds = wholePixelRect(rect)
  if (bounds === null) {
    return { ok: false, error: 'unavailable' }
  }
  try {
    const image = await source.capturePage(bounds)
    if (image.isEmpty()) {
      return { ok: false, error: 'unavailable' }
    }
    const png = image.toPNG()
    if (png.length > PROTOTYPE_ATTACHMENT_MAX_BYTES) {
      return { ok: false, error: 'too_large' }
    }
    return { ok: true, pngBase64: png.toString('base64') }
  } catch {
    return { ok: false, error: 'unavailable' }
  }
}

/** The rectangle in whole pixels with a non-negative origin, or null when a side is out of range. */
function wholePixelRect(rect: unknown): PrototypeCaptureRect | null {
  const parsed = CaptureRectSchema.safeParse(rect)
  if (!parsed.success) {
    return null
  }
  const { x, y, width, height } = parsed.data
  if (![x, y, width, height].every(Number.isFinite)) {
    return null
  }
  const bounds = {
    x: Math.max(0, Math.floor(x)),
    y: Math.max(0, Math.floor(y)),
    width: Math.floor(width),
    height: Math.floor(height)
  }
  const sized = [bounds.width, bounds.height].every((side) => side >= 1 && side <= MAX_CAPTURE_SIDE)
  return sized ? bounds : null
}
