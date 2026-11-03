import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'
import { MarketplaceCatalogList } from './MarketplaceCatalogList'
import { MarketplaceDetail } from './MarketplaceDetail'
import { MarketplaceHeader } from './MarketplaceHeader'
import { MARKETPLACE_CATALOG, type MarketplaceItemId } from './marketplace-catalog'
import {
  marketplaceBadgeState,
  type MarketplaceBadgeState,
  type MarketplaceStatusInputs
} from './marketplace-status'
import { useMarketplaceDetection } from './use-marketplace-detection'

export default function MarketplacePage(): React.JSX.Element {
  const closeMarketplacePage = useAppStore((s) => s.closeMarketplacePage)
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const preflightStatusChecked = useAppStore((s) => s.preflightStatusChecked)
  const preflightStatusContextKey = useAppStore((s) => s.preflightStatusContextKey)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)
  const expectedPreflightContextKey = useAppStore((s) =>
    localPreflightContextKey(getLocalPreflightContext(s))
  )
  const preflightCurrent = preflightStatusContextKey === expectedPreflightContextKey
  const { state: detection, refresh: refreshDetection } = useMarketplaceDetection()
  const [selectedId, setSelectedId] = useState<MarketplaceItemId | null>(null)

  // Why: same refresh rule as the Tasks sidebar row, so both read one preflight result.
  useEffect(() => {
    if (!preflightStatusChecked || !preflightCurrent) {
      void refreshPreflightStatus()
    }
  }, [preflightCurrent, preflightStatusChecked, refreshPreflightStatus])

  const inputs: MarketplaceStatusInputs = {
    preflight: preflightCurrent ? preflightStatus : null,
    preflightChecked: preflightStatusChecked && preflightCurrent,
    detection
  }
  const badgeStateFor = (id: MarketplaceItemId): MarketplaceBadgeState =>
    marketplaceBadgeState(id, inputs)
  const selectedItem = MARKETPLACE_CATALOG.find((item) => item.id === selectedId) ?? null

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <MarketplaceHeader onClose={closeMarketplacePage} />
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        {selectedItem ? (
          <MarketplaceDetail
            item={selectedItem}
            badgeState={badgeStateFor(selectedItem.id)}
            detection={detection}
            onBack={() => setSelectedId(null)}
            onDetectionChanged={refreshDetection}
          />
        ) : (
          <MarketplaceCatalogList
            badgeStateFor={badgeStateFor}
            onSelect={(id) => setSelectedId(id)}
          />
        )}
      </div>
    </div>
  )
}
