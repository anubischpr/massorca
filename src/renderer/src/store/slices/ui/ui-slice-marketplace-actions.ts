import type { MarketplaceAppsApi } from '../../../../../shared/marketplace-apps'
import type { UISlice, UISliceSet } from './ui-slice-contract'

export function createUiMarketplaceActions(set: UISliceSet): Partial<UISlice> {
  return {
    marketplaceSection: 'all',
    setMarketplaceSection: (section) => set({ marketplaceSection: section }),
    marketplaceSelectedItemId: null,
    selectMarketplaceItem: (id) => set({ marketplaceSelectedItemId: id }),
    marketplaceApps: { status: 'loading' },
    refreshMarketplaceApps: async () => {
      // Why: the web client has no marketplace bridge; the apps read as unavailable instead of throwing.
      const api: MarketplaceAppsApi | undefined = window.api?.marketplaceApps
      if (!api) {
        set({ marketplaceApps: { status: 'unavailable' } })
        return
      }
      try {
        set({ marketplaceApps: { status: 'ready', apps: await api.listApps() } })
      } catch {
        set({ marketplaceApps: { status: 'failed' } })
      }
    }
  }
}
