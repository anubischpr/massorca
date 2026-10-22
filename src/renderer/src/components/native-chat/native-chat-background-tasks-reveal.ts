import { useSyncExternalStore } from 'react'

// `/ps` asks a chat's background-tasks strip to open itself. The request is a counter per chat, so
// the strip keeps owning its expanded state and a request made while it is not shown is never held.
const sequences = new Map<string, number>()
const listeners = new Set<() => void>()

export function requestNativeChatBackgroundTasksReveal(sessionId: string): void {
  sequences.set(sessionId, (sequences.get(sessionId) ?? 0) + 1)
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useNativeChatBackgroundTasksRevealSequence(sessionId: string): number {
  return useSyncExternalStore(subscribe, () => sequences.get(sessionId) ?? 0)
}
