import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { MarketplaceAppPage } from './MarketplaceAppPage'
import { MarketplaceCatalogList } from './MarketplaceCatalogList'
import { MarketplaceDetail } from './MarketplaceDetail'
import { MarketplaceHeader } from './MarketplaceHeader'
import { MARKETPLACE_CATALOG, type MarketplaceItemId } from './marketplace-catalog'
import {
  marketplaceBadgeState,
  type MarketplaceBadgeState,
  type MarketplaceStatusInputs
} from './marketplace-status'
import { useMarketplacePreflight } from './use-marketplace-preflight'

export default function MarketplacePage(): React.JSX.Element {
  const closeMarketplacePage = useAppStore((s) => s.closeMarketplacePage)
  const section = useAppStore((s) => s.marketplaceSection)
  const selectedId = useAppStore((s) => s.marketplaceSelectedItemId)
  const selectItem = useAppStore((s) => s.selectMarketplaceItem)
  const apps = useAppStore((s) => s.marketplaceApps)
  const refreshApps = useAppStore((s) => s.refreshMarketplaceApps)
  const preflight = useMarketplacePreflight({ refreshOnMount: true })
  const selectedItem = MARKETPLACE_CATALOG.find((item) => item.id === selectedId)

  useEffect(() => {
    void refreshApps()
  }, [refreshApps])

  const inputs: MarketplaceStatusInputs = {
    preflight: preflight.preflight,
    preflightChecked: preflight.checked,
    apps
  }
  const badgeStateFor = (id: MarketplaceItemId): MarketplaceBadgeState =>
    marketplaceBadgeState(id, inputs)
  const backToCatalog = (): void => selectItem(null)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-chat-canvas">
      <MarketplaceHeader onClose={closeMarketplacePage} />
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        {selectedItem === undefined ? (
          <MarketplaceCatalogList
            section={section}
            badgeStateFor={badgeStateFor}
            onSelect={(id) => selectItem(id)}
          />
        ) : selectedItem.id === 'git' ? (
          <MarketplaceDetail
            item={selectedItem}
            badgeState={badgeStateFor('git')}
            onBack={backToCatalog}
          />
        ) : (
          <MarketplaceAppPage appId={selectedItem.id} onBack={backToCatalog} />
        )}
      </div>
    </div>
  )
}
