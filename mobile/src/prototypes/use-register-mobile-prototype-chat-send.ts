import { useEffect, useLayoutEffect, useRef } from 'react'
import { registerMobilePrototypeChatSend } from './mobile-prototype-chat-send-registry'

type ChatSend = { sessionId: string; send: (text: string) => Promise<boolean> }

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
      latest.current ? latest.current.send(text) : Promise.resolve(false)
    )
  }, [sessionId])
}
