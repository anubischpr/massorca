import { useSyncExternalStore } from 'react'

// Why a module-level slot: the session's own pane owns its actions' state, so it renders them
// into the shell's bar instead of the shell reaching into every pane kind.
let target: HTMLElement | null = null
const listeners = new Set<() => void>()

export function setSessionBarActionsTarget(element: HTMLElement | null): void {
  if (target === element) {
    return
  }
  target = element
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The element panes render their session actions into; null when no bar is mounted. */
export function useSessionBarActionsTarget(): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => target,
    () => null
  )
}
