import { useEffect, useState } from 'react'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { listPrototypeSetsFromAllHosts } from './prototype-host-targets'

const POLL_MS = 10_000

type Listener = (sets: readonly PrototypeListedSet[]) => void

// One shared poll for every chat link card on screen, so many cards cost one list per host.
const listeners = new Set<Listener>()
let latest: readonly PrototypeListedSet[] = []
let timer: number | null = null

function refresh(): void {
  void listPrototypeSetsFromAllHosts().then((listed) => {
    if (listed.answered) {
      latest = listed.sets
      listeners.forEach((listener) => listener(latest))
    }
  })
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    refresh()
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }, POLL_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }
}

/** The listed set of one request, once its agent has written a direction; null until then. */
export function usePrototypeSetForRequest(requestId: string): PrototypeListedSet | null {
  const [sets, setSets] = useState<readonly PrototypeListedSet[]>(latest)
  useEffect(() => subscribe(setSets), [])
  return sets.find((set) => set.requestId === requestId) ?? null
}
