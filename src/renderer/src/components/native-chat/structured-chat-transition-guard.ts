import { useSyncExternalStore } from 'react'

// A chat<->terminal switch stops one process and starts another, so a repeat click while it runs
// must do nothing: it would start one more terminal per click.
const held = new Map<string, number>()
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

/** The key a chat's switch holds, shared by both directions so neither can start during the other. */
export function chatTransitionKeyForSession(sessionId: string): string {
  return `chat:${sessionId}`
}

/** The key a terminal tab's switch holds, so its own button can show the pending state. */
export function chatTransitionKeyForTerminalTab(tabId: string): string {
  return `terminal:${tabId}`
}

/** Takes every key, or none when any is already held. The returned release is safe to call twice. */
export function beginChatTransition(keys: readonly string[]): (() => void) | null {
  if (keys.some((key) => held.has(key))) {
    return null
  }
  for (const key of keys) {
    held.set(key, 1)
  }
  notify()
  let released = false
  return () => {
    if (released) {
      return
    }
    released = true
    for (const key of keys) {
      held.delete(key)
    }
    notify()
  }
}

/** Runs one switch under its keys; resolves `undefined` without running when one is already underway. */
export async function runChatTransition<T>(
  keys: readonly string[],
  run: () => Promise<T>
): Promise<T | undefined> {
  const release = beginChatTransition(keys)
  if (!release) {
    return undefined
  }
  try {
    return await run()
  } finally {
    release()
  }
}

export function isChatTransitionPending(key: string): boolean {
  return held.has(key)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useChatTransitionPending(key: string | null | undefined): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (key ? held.has(key) : false),
    () => false
  )
}
