import { useCallback, useEffect, useState } from 'react'
import { useMountedRef } from '@/hooks/useMountedRef'
import type { MarketplaceApi, MarketplaceDetection } from '../../../../shared/marketplace-types'

export type MarketplaceDetectionState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'failed' }
  | { status: 'ready'; detection: MarketplaceDetection }

export function useMarketplaceDetection(): {
  state: MarketplaceDetectionState
  refresh: () => Promise<void>
} {
  const [state, setState] = useState<MarketplaceDetectionState>({ status: 'loading' })
  const mountedRef = useMountedRef()

  const refresh = useCallback(async (): Promise<void> => {
    // Why: the web client has no marketplace bridge, so the page degrades instead of throwing.
    const marketplace: MarketplaceApi | undefined = window.api?.marketplace
    if (!marketplace) {
      setState({ status: 'unavailable' })
      return
    }
    try {
      const detection = await marketplace.detect()
      if (mountedRef.current) {
        setState({ status: 'ready', detection })
      }
    } catch {
      if (mountedRef.current) {
        setState({ status: 'failed' })
      }
    }
  }, [mountedRef])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { state, refresh }
}
