import { useSyncExternalStore } from 'react'

// Why a registry: a session shown by reference runs in its owner's overlay layer, which sits inside
// the owner's hidden surface and so has no box. Its host is portaled into the visible layout that
// shows it, where the pane's anchor is in the same containing block.
const roots = new Map<string, HTMLElement>()
const listeners = new Set<() => void>()

export function setLayoutOverlayRoot(worktreeId: string, element: HTMLElement | null): void {
  if (element ? roots.get(worktreeId) === element : !roots.has(worktreeId)) {
    return
  }
  if (element) {
    roots.set(worktreeId, element)
  } else {
    roots.delete(worktreeId)
  }
  for (const listener of listeners) {
    listener()
  }
}

const refs = new Map<string, (element: HTMLElement | null) => void>()

/** A stable ref callback that registers a layout's overlay root. */
export function layoutOverlayRootRef(worktreeId: string): (element: HTMLElement | null) => void {
  let ref = refs.get(worktreeId)
  if (!ref) {
    ref = (element) => setLayoutOverlayRoot(worktreeId, element)
    refs.set(worktreeId, ref)
  }
  return ref
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The element a layout's overlay hosts belong in; null while that layout is not mounted. */
export function useLayoutOverlayRoot(worktreeId: string | null): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => (worktreeId ? (roots.get(worktreeId) ?? null) : null),
    () => null
  )
}
