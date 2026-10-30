import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import type { RpcClient } from '../transport/rpc-client'
import { sendToMobilePrototypeChat } from './mobile-prototype-chat-send-registry'
import { sendToStructuredSessionOnHost } from './mobile-prototype-host-chat-send'

/**
 * Sends one message to the set's chat: through the chat on screen when it is that chat, else
 * through the host by the set's session. True only when the chat took it.
 */
export function sendMobilePrototypeText(
  client: RpcClient | null,
  set: Pick<PrototypeListedSet, 'sessionId'>,
  text: string
): Promise<boolean> {
  const viaHost =
    client === null
      ? null
      : (message: string) => sendToStructuredSessionOnHost(client, set.sessionId, message)
  return sendToMobilePrototypeChat(set.sessionId, text, viaHost)
}
