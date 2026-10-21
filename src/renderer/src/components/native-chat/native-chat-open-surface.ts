import { useEffect, useRef, useSyncExternalStore } from 'react'

// `/context` and `/mention` ask a part of one chat to open itself. A request waits until a mounted
// part takes it, so the part that opens a closed surface still receives the request it was opened for.
export type NativeChatOpenSurface = 'context' | 'mention'

const pending = new Map<string, readonly string[]>()
const listeners = new Set<() => void>()

function keyOf(sessionId: string, surface: NativeChatOpenSurface): string {
  return `${surface}:${sessionId}`
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Asks the chat's part for `surface` to open; `detail` is what the request carries, such as a mention's query. */
export function requestNativeChatOpenSurface(
  sessionId: string,
  surface: NativeChatOpenSurface,
  detail = ''
): void {
  const key = keyOf(sessionId, surface)
  pending.set(key, [...(pending.get(key) ?? []), detail])
  notify()
}

/** Calls `open` once per held request for this chat and surface, taken by the first part mounted for it. */
export function useNativeChatOpenSurfaceRequests(
  sessionId: string | null,
  surface: NativeChatOpenSurface,
  open: (detail: string) => void
): void {
  const key = sessionId === null ? null : keyOf(sessionId, surface)
  const held = useSyncExternalStore(subscribe, () =>
    key === null ? 0 : (pending.get(key)?.length ?? 0)
  )
  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  })
  useEffect(() => {
    if (key === null || held === 0) {
      return
    }
    const details = pending.get(key) ?? []
    pending.delete(key)
    notify()
    for (const detail of details) {
      openRef.current(detail)
    }
  }, [held, key])
}
