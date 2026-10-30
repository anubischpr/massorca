import { sendPrototypeIteration, type PrototypeSendDeps } from '../../../src/shared/prototype-send'
import type { PrototypeSetState } from '../../../src/shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { writeMobilePrototypeAttachment } from '../session/mobile-prototype-host-rpc'
import type { RpcClient } from '../transport/rpc-client'
import type { MobilePrototypeFrameHandle } from './mobile-prototype-capture-math'
import { sendMobilePrototypeText } from './mobile-prototype-chat-text-send'

/** Each pin's picture is taken from the frame and saved on the host; a failure drops that picture only. */
function screenshotDeps(
  client: RpcClient,
  set: PrototypeListedSet,
  frame: MobilePrototypeFrameHandle
): Pick<PrototypeSendDeps, 'captureRect' | 'writeAttachment'> {
  return {
    captureRect: (rect) => frame.capturePin(rect),
    writeAttachment: async (name, pngBase64) => {
      const written = await writeMobilePrototypeAttachment(client, {
        sessionId: set.sessionId,
        requestId: set.requestId,
        name,
        pngBase64
      })
      return written.kind === 'ready' ? { ok: true, path: written.path } : { ok: false }
    }
  }
}

/**
 * Sends one iteration to the set's chat as a single message: through the chat on screen when it is
 * that chat, else through the host by the set's session. With the frame on screen, each pin's
 * element is photographed and its host path joins the message, as on desktop; without it, or when
 * a picture fails, the message goes without that picture. When the chat does not take the message,
 * the caller keeps the draft.
 */
export function sendMobilePrototypeIteration(
  state: PrototypeSetState,
  set: PrototypeListedSet,
  client: RpcClient | null,
  frame: MobilePrototypeFrameHandle | null = null
): ReturnType<typeof sendPrototypeIteration> {
  return sendPrototypeIteration(
    {
      state,
      set,
      // The pins' rectangles are in the page's own pixels, so the page is the origin.
      frameOrigin: frame === null ? null : { x: 0, y: 0, ...frame.pageSize }
    },
    {
      ...(client !== null && frame !== null ? screenshotDeps(client, set, frame) : {}),
      sendMessage: (text) => sendMobilePrototypeText(client, set, text),
      now: Date.now
    }
  )
}
