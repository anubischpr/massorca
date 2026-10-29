import type { NativeChatVisualRect } from '../../../../shared/native-chat-visual-annotate'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { pinsOf, type PrototypeSetState } from './prototype-set-state'
import { draftOf, iterationSendText, nextVersionOf, visibleMessageOf } from './prototype-set-view'

// The send of one iteration: a screenshot per pin the frame still shows, then one message to the
// chat. A failed capture or upload only drops that screenshot; a refused send keeps the draft.

export type PrototypeSendDeps = {
  /** A rectangle of the window, in CSS pixels, as PNG base64; a failure is `ok: false`. */
  captureRect: (
    rect: NativeChatVisualRect
  ) => Promise<{ ok: true; pngBase64: string } | { ok: false }>
  /** Writes one PNG on the host and returns its absolute path; any failure rejects or is `ok: false`. */
  writeAttachment: (
    name: string,
    pngBase64: string
  ) => Promise<{ ok: true; path: string } | { ok: false }>
  /** Hands the text to the set's chat; true only when the chat took it. */
  sendMessage: (text: string) => Promise<boolean>
  now: () => number
}

export type PrototypeSendInput = {
  state: PrototypeSetState
  set: PrototypeListedSet
  /** The frame's box in the window; null when no frame is on screen. */
  frameOrigin: NativeChatVisualRect | null
}

export type PrototypeSendOutcome = {
  sent: boolean
  /** The visible message: what the chat shows and the sent card repeats. */
  visibleMessage: string
}

async function captureScreenshots(
  input: PrototypeSendInput,
  deps: PrototypeSendDeps
): Promise<Record<string, string>> {
  const { state, frameOrigin } = input
  const screenshots: Record<string, string> = {}
  // Captures need the iterated direction on screen; a peek shows another frame.
  if (frameOrigin === null || state.view !== state.active) {
    return screenshots
  }
  const pinKeys = new Set(
    draftOf(state)
      .groups.filter((group) => group.items.every((item) => item.letter === state.active))
      .map((group) => group.pinKey)
  )
  for (const pin of pinsOf(state, state.active)) {
    if (!pinKeys.has(pin.pinKey) || pin.viewport !== state.viewport) {
      continue
    }
    const rect = {
      x: frameOrigin.x + pin.rect.x,
      y: frameOrigin.y + pin.rect.y,
      width: pin.rect.width,
      height: pin.rect.height
    }
    try {
      const capture = await deps.captureRect(rect)
      if (!capture.ok) {
        continue
      }
      const written = await deps.writeAttachment(
        `pin-${pin.pinKey}-${deps.now()}`,
        capture.pngBase64
      )
      if (written.ok) {
        screenshots[pin.pinKey] = written.path
      }
    } catch {
      // A failed screenshot is left out; the message still goes.
    }
  }
  return screenshots
}

/**
 * Sends the iteration. Returns whether the chat took it and the visible message; the caller applies
 * the outcome to the set state it holds at that time.
 */
export async function sendPrototypeIteration(
  input: PrototypeSendInput,
  deps: PrototypeSendDeps
): Promise<PrototypeSendOutcome> {
  const { state, set } = input
  const visibleWithoutShots = visibleMessageOf(state)
  if (set.folderPath === undefined) {
    return { sent: false, visibleMessage: visibleWithoutShots }
  }
  const screenshots = await captureScreenshots(input, deps)
  const visibleMessage = visibleMessageOf(state, screenshots)
  const text = iterationSendText({
    visibleMessage,
    requestId: set.requestId,
    letter: state.active,
    nextVersion: nextVersionOf(set.directions, state.active),
    folderPath: set.folderPath
  })
  try {
    return { sent: await deps.sendMessage(text), visibleMessage }
  } catch {
    return { sent: false, visibleMessage }
  }
}
