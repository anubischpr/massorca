// The chats that can take a message right now. The session screen stays mounted under the Prototypes
// screens, so the chat on screen registers its plain send here; a set of any other chat has none.

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

/** True only when the chat took the message; a chat that is not on screen takes none. */
export async function sendToMobilePrototypeChat(sessionId: string, text: string): Promise<boolean> {
  const send = senders.get(sessionId)
  if (send === undefined) {
    return false
  }
  try {
    return await send(text)
  } catch {
    return false
  }
}
