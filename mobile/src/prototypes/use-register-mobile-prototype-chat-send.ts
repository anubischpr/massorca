import { useEffect, useLayoutEffect, useRef } from 'react'
import { registerMobilePrototypeChatSend } from './mobile-prototype-chat-send-registry'

type ChatSend = { sessionId: string; send: (text: string) => Promise<boolean> }

/** Sends through the latest chat only when it is still the session this send was registered for. */
export function sendThroughLatestChat(
  latest: ChatSend | null,
  sessionId: string,
  text: string
): Promise<boolean> {
  return latest !== null && latest.sessionId === sessionId
    ? latest.send(text)
    : Promise.resolve(false)
}

/**
 * Registers the chat on screen as the one the Prototypes screens send through. The registration is
 * keyed by the session alone; it calls the chat's latest send, so a send rebuilt on a render is
 * never a reason to register again, and a stale send is never the one called.
 */
export function useRegisterMobilePrototypeChatSend(chat: ChatSend | null): void {
  const latest = useRef(chat)
  useLayoutEffect(() => {
    latest.current = chat
  }, [chat])
  const sessionId = chat?.sessionId ?? null
  useEffect(() => {
    if (sessionId === null) {
      return undefined
    }
    return registerMobilePrototypeChatSend(sessionId, (text) =>
      sendThroughLatestChat(latest.current, sessionId, text)
    )
  }, [sessionId])
}
