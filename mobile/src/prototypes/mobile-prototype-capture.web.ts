import type { RefObject } from 'react'
import type { View } from 'react-native'
import type { NativeChatVisualRect } from '../../../src/shared/native-chat-visual-annotate'
import type { MobilePrototypeCapture } from './mobile-prototype-capture-math'

export type { MobilePrototypeCapture } from './mobile-prototype-capture-math'

/**
 * Web sibling: no screenshot. The page shows a sealed, script-free frame that takes no picks, so
 * there is no pin to capture, and `react-native-view-shot` (with the canvas library under it) and
 * `expo-image-manipulator` stay out of the page bundle, whose asset count is held.
 */
export async function capturePrototypePin(_input: {
  frame: RefObject<View | null>
  frameSize: { width: number; height: number }
  scale: number
  rect: NativeChatVisualRect
}): Promise<MobilePrototypeCapture> {
  return { ok: false }
}
