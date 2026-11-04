import { useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import {
  marketplaceAppMention,
  type MarketplaceAppMention
} from '../../../../shared/marketplace-app-mentions'

const NO_APPS: readonly MarketplaceAppMention[] = []

/** The connected Marketplace apps an @ menu offers; none where the bridge is missing, as in the web client. */
export function useConnectedMarketplaceApps(): readonly MarketplaceAppMention[] {
  // Why optional: a store without the Marketplace slice (a partial test store) offers no apps.
  const apps = useAppStore((s) => s.marketplaceApps) ?? null
  const refresh = useAppStore((s) => s.refreshMarketplaceApps) ?? null
  const loading = apps?.status === 'loading'
  useEffect(() => {
    if (loading) {
      void refresh?.()
    }
  }, [loading, refresh])
  return useMemo(
    () =>
      apps?.status === 'ready'
        ? apps.apps.filter((app) => app.connected).map((app) => marketplaceAppMention(app.id))
        : NO_APPS,
    [apps]
  )
}
