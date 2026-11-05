import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'
import type { PreflightStatus } from '../../../../preload/api-types'

export type MarketplacePreflight = {
  // Null when the result is not for this computer yet, or the check failed.
  preflight: PreflightStatus | null
  checked: boolean
}

/**
 * The local preflight result Git and GitHub read; refreshes it once when the page asks.
 * `forceOnMount` skips the cache, for pages whose cached result can show a stale state.
 */
export function useMarketplacePreflight({
  refreshOnMount,
  forceOnMount = false
}: {
  refreshOnMount: boolean
  forceOnMount?: boolean
}): MarketplacePreflight {
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const preflightStatusChecked = useAppStore((s) => s.preflightStatusChecked)
  const preflightStatusContextKey = useAppStore((s) => s.preflightStatusContextKey)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)
  const expectedContextKey = useAppStore((s) =>
    localPreflightContextKey(getLocalPreflightContext(s))
  )
  const current = preflightStatusContextKey === expectedContextKey

  useEffect(() => {
    // Why: same refresh rule as the Tasks sidebar row, so both read one preflight result.
    if (refreshOnMount && (!preflightStatusChecked || !current)) {
      void refreshPreflightStatus()
    }
  }, [current, preflightStatusChecked, refreshOnMount, refreshPreflightStatus])

  useEffect(() => {
    // Why: a cached result can still say GitHub is disconnected; the page opening asks for a fresh read once.
    if (forceOnMount) {
      void refreshPreflightStatus({ force: true })
    }
  }, [forceOnMount, refreshPreflightStatus])

  return {
    preflight: current ? preflightStatus : null,
    checked: preflightStatusChecked && current
  }
}
