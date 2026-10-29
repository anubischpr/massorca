import { useCallback, useEffect, useState } from 'react'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { listPrototypeSetsFromAllHosts } from './prototype-host-targets'

/** The Prototypes view re-lists while it is visible, so new versions show without a click. */
const VIEW_REFRESH_MS = 10_000

export type PrototypeSetsResult = {
  status: 'loading' | 'ready' | 'outdated' | 'error'
  sets: readonly PrototypeListedSet[]
}

/** The host's sets; refreshed on focus and every few seconds while the document is visible. */
export function usePrototypeSets(): PrototypeSetsResult {
  const [result, setResult] = useState<PrototypeSetsResult>({ status: 'loading', sets: [] })
  const load = useCallback(() => {
    void listPrototypeSetsFromAllHosts().then((listed) =>
      setResult((previous) =>
        listed.answered
          ? { status: 'ready', sets: listed.sets }
          : { status: listed.onlyOutdated ? 'outdated' : 'error', sets: previous.sets }
      )
    )
  }, [])
  useEffect(() => {
    load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        load()
      }
    }, VIEW_REFRESH_MS)
    window.addEventListener('focus', load)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [load])
  return result
}
