import { sendPrototypeIteration } from '../../../src/shared/prototype-send'
import type { PrototypeSetState } from '../../../src/shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { sendToMobilePrototypeChat } from './mobile-prototype-chat-send-registry'

/**
 * Sends one iteration to the set's chat as a single message. A phone cannot capture a pin's
 * screenshot, so the message goes without them; a chat that is not on screen takes nothing, and the
 * caller keeps the draft.
 */
export function sendMobilePrototypeIteration(
  state: PrototypeSetState,
  set: PrototypeListedSet
): ReturnType<typeof sendPrototypeIteration> {
  return sendPrototypeIteration(
    { state, set, frameOrigin: null },
    { sendMessage: (text) => sendToMobilePrototypeChat(set.sessionId, text), now: Date.now }
  )
}
