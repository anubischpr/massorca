import { useEffect, useMemo } from 'react'
import { useAppStore } from '@/store'
import {
  marketplaceAppMention,
  type MarketplaceAppMention
} from '../../../../shared/marketplace-app-mentions'

const NO_APPS: readonly MarketplaceAppMention[] = []

/** The connected Marketplace apps an @ menu offers; none where the bridge is missing, as in the web client. */
export function useConnectedMarketplaceApps(): readonly MarketplaceAppMention[] {
  const apps = useAppStore((s) => s.marketplaceApps)
  const refresh = useAppStore((s) => s.refreshMarketplaceApps)
  const loading = apps.status === 'loading'
  useEffect(() => {
    if (loading) {
      void refresh()
    }
  }, [loading, refresh])
  return useMemo(
    () =>
      apps.status === 'ready'
        ? apps.apps.filter((app) => app.connected).map((app) => marketplaceAppMention(app.id))
        : NO_APPS,
    [apps]
  )
}
