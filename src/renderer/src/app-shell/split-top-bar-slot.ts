import { useSyncExternalStore } from 'react'

// Why: each top pane of a split owns the row over its own half, so its actions portal into that row by group.
const targets = new Map<string, HTMLElement>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setSplitTopBarActionsTarget(groupId: string, element: HTMLElement | null): void {
  if (element ? targets.get(groupId) === element : !targets.has(groupId)) {
    return
  }
  if (element) {
    targets.set(groupId, element)
  } else {
    targets.delete(groupId)
  }
  for (const listener of listeners) {
    listener()
  }
}

/** The actions element of a pane group's top row, or null when that group has no top row. */
export function useSplitTopBarActionsTarget(groupId: string | undefined): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => (groupId ? (targets.get(groupId) ?? null) : null),
    () => null
  )
}
