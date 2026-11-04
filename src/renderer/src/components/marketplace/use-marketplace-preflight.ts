import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'
import type { PreflightStatus } from '../../../../preload/api-types'

export type MarketplacePreflight = {
  // Null when the result is not for this computer yet, or the check failed.
  preflight: PreflightStatus | null
  checked: boolean
}

/** The local preflight result Git and GitHub read; refreshes it once when the page asks. */
export function useMarketplacePreflight({
  refreshOnMount
}: {
  refreshOnMount: boolean
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

  return {
    preflight: current ? preflightStatus : null,
    checked: preflightStatusChecked && current
  }
}
