import { sendPrototypeIteration } from '../../../src/shared/prototype-send'
import type { PrototypeSetState } from '../../../src/shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import type { RpcClient } from '../transport/rpc-client'
import { sendToMobilePrototypeChat } from './mobile-prototype-chat-send-registry'
import { sendToStructuredSessionOnHost } from './mobile-prototype-host-chat-send'

/**
 * Sends one iteration to the set's chat as a single message: through the chat on screen when it is
 * that chat, else through the host by the set's session. A phone cannot capture a pin's screenshot,
 * so the message goes without them; when the chat does not take it, the caller keeps the draft.
 */
export function sendMobilePrototypeIteration(
  state: PrototypeSetState,
  set: PrototypeListedSet,
  client: RpcClient | null
): ReturnType<typeof sendPrototypeIteration> {
  const viaHost =
    client === null
      ? null
      : (text: string) => sendToStructuredSessionOnHost(client, set.sessionId, text)
  return sendPrototypeIteration(
    { state, set, frameOrigin: null },
    {
      sendMessage: (text) => sendToMobilePrototypeChat(set.sessionId, text, viaHost),
      now: Date.now
    }
  )
}
