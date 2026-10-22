import { useSyncExternalStore } from 'react'

// Whether a chat shows what came before its newest /clear. Collapsed unless the person opened it,
// per chat, kept in the browser so a reload keeps the choice.
const STORAGE_PREFIX = 'orca.nativeChat.earlierContext.'
const shownBySession = new Map<string, boolean>()
const listeners = new Set<() => void>()

function readStored(sessionId: string): boolean {
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`) === '1'
  } catch {
    return false
  }
}

function isShown(sessionId: string): boolean {
  let shown = shownBySession.get(sessionId)
  if (shown === undefined) {
    shown = readStored(sessionId)
    shownBySession.set(sessionId, shown)
  }
  return shown
}

export function setNativeChatEarlierContextShown(sessionId: string, shown: boolean): void {
  shownBySession.set(sessionId, shown)
  try {
    if (shown) {
      window.localStorage.setItem(`${STORAGE_PREFIX}${sessionId}`, '1')
    } else {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${sessionId}`)
    }
  } catch {
    // Storage can be blocked; the choice then lasts until the window closes.
  }
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useNativeChatEarlierContextShown(sessionId: string): boolean {
  return useSyncExternalStore(subscribe, () => isShown(sessionId))
}
