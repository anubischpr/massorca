// The chat on screen takes a message through its own send. The session screen stays mounted under
// the Prototypes screens, so that chat registers its plain send here; any other chat has none.

type ChatSend = (text: string) => Promise<boolean>

const senders = new Map<string, ChatSend>()

/** Registers the chat's send; the returned function removes it unless a newer one replaced it. */
export function registerMobilePrototypeChatSend(sessionId: string, send: ChatSend): () => void {
  senders.set(sessionId, send)
  return () => {
    if (senders.get(sessionId) === send) {
      senders.delete(sessionId)
    }
  }
}

/**
 * True only when the chat took the message. The chat on screen takes it through its own send; any
 * other chat goes through `viaHost`, when there is one. A send that was tried and failed is never
 * retried the other way, so a message cannot arrive twice.
 */
export async function sendToMobilePrototypeChat(
  sessionId: string,
  text: string,
  viaHost: ChatSend | null = null
): Promise<boolean> {
  const send = senders.get(sessionId) ?? viaHost
  if (send === null) {
    return false
  }
  try {
    return await send(text)
  } catch {
    return false
  }
}
