import { useSyncExternalStore } from 'react'

/**
 * A module-level slot a bar exposes so the page below it can render its own actions into the bar,
 * instead of the shell reaching into every page.
 */
export function createBarActionsSlot(): {
  setTarget: (element: HTMLElement | null) => void
  useTarget: () => HTMLElement | null
} {
  let target: HTMLElement | null = null
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  return {
    setTarget: (element) => {
      if (target === element) {
        return
      }
      target = element
      for (const listener of listeners) {
        listener()
      }
    },
    useTarget: () =>
      useSyncExternalStore(
        subscribe,
        () => target,
        () => null
      )
  }
}
