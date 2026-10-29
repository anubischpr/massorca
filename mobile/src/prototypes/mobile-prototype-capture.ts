import { PixelRatio, type View } from 'react-native'
import type { RefObject } from 'react'
import { File as FsFile } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { captureRef } from 'react-native-view-shot'
import type { NativeChatVisualRect } from '../../../src/shared/native-chat-visual-annotate'
import {
  PROTOTYPE_CAPTURE_MAX_WIDTH_PX,
  prototypeCaptureCrop,
  type MobilePrototypeCapture
} from './mobile-prototype-capture-math'

export type { MobilePrototypeCapture } from './mobile-prototype-capture-math'

function removeQuietly(uri: string | null): void {
  if (uri === null) {
    return
  }
  try {
    new FsFile(uri).delete()
  } catch {
    // Best-effort: the OS reclaims the cache directory regardless.
  }
}

/**
 * One pin's picture, taken from the frame's view and cropped to the element. `rect` is in the page's
 * pixels; the frame is drawn at `scale` points per page pixel. Native only: the web build gets a
 * no-op, so neither library reaches the page bundle. Any failure is no screenshot, never an error.
 */
export async function capturePrototypePin(input: {
  frame: RefObject<View | null>
  frameSize: { width: number; height: number }
  scale: number
  rect: NativeChatVisualRect
}): Promise<MobilePrototypeCapture> {
  const { frame, frameSize, scale, rect } = input
  const target = frame.current
  const pixelRatio = PixelRatio.get()
  const crop = prototypeCaptureCrop({ rect, scale, pixelRatio, frame: frameSize })
  if (target === null || crop === null) {
    return { ok: false }
  }
  let pictureUri: string | null = null
  let savedUri: string | null = null
  let context: ReturnType<typeof ImageManipulator.manipulate> | null = null
  let rendered: Awaited<
    ReturnType<ReturnType<typeof ImageManipulator.manipulate>['renderAsync']>
  > | null = null
  try {
    // Sized in pixels, so the crop's coordinates are the picture's own.
    pictureUri = await captureRef(target, {
      format: 'png',
      result: 'tmpfile',
      width: Math.round(frameSize.width * pixelRatio),
      height: Math.round(frameSize.height * pixelRatio)
    })
    context = ImageManipulator.manipulate(pictureUri)
    context.crop(crop)
    if (crop.width > PROTOTYPE_CAPTURE_MAX_WIDTH_PX) {
      context.resize({ width: PROTOTYPE_CAPTURE_MAX_WIDTH_PX })
    }
    rendered = await context.renderAsync()
    const saved = await rendered.saveAsync({ format: SaveFormat.PNG, base64: true })
    savedUri = saved.uri
    return saved.base64 ? { ok: true, pngBase64: saved.base64 } : { ok: false }
  } catch {
    return { ok: false }
  } finally {
    rendered?.release()
    context?.release()
    removeQuietly(savedUri)
    removeQuietly(pictureUri)
  }
}
