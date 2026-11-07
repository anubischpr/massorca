import { useCallback, useEffect, useState } from 'react'
import { useActiveSkillDiscoveryRuntimeTarget } from '@/hooks/use-active-skill-discovery-runtime-target'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { MarketplaceItemId } from '@/store/slices/ui/ui-slice-contract-core'
import { MarketplaceAppPage } from '../marketplace/MarketplaceAppPage'
import { useMarketplaceCatalog } from '../marketplace/MarketplaceCatalogData'
import { MarketplaceCatalogList } from '../marketplace/MarketplaceCatalogList'
import type { CatalogRow } from '../marketplace/MarketplaceCatalogRows'
import { MarketplaceDetail } from '../marketplace/MarketplaceDetail'
import { MarketplaceOpenPageView } from '../marketplace/MarketplaceOpenPageView'
import { MARKETPLACE_CATALOG } from '../marketplace/marketplace-catalog'
import { useMarketplaceAppHost } from '../marketplace/use-marketplace-app-host'
import { marketplaceHostKey } from '../marketplace/use-marketplace-host-targets'
import { useMarketplaceOpenPage } from '../marketplace/use-marketplace-open-page'

/** The one shared Marketplace inside Settings: the same catalog rows, each opening its detail page. */
export function MarketplaceSettingsPane(): React.JSX.Element {
  const refreshApps = useAppStore((state) => state.refreshMarketplaceApps)
  const host = useMarketplaceAppHost()
  const skillTarget = useActiveSkillDiscoveryRuntimeTarget()
  const thisComputer = translate(
    'auto.components.marketplace.MarketplaceAppHostPicker.thisComputer',
    'This computer'
  )
  const pickedTarget = host.targets.find(
    (target) => marketplaceHostKey(target) === host.selectedKey
  )
  const hostLabel = pickedTarget?.label ?? thisComputer
  const catalog = useMarketplaceCatalog({
    hostLabel,
    local: host.selectedKey === null,
    remoteTarget: pickedTarget ?? null,
    apps: host.apps,
    refreshPreflight: true
  })
  // Why: Settings keeps its open app page locally, so the Marketplace view's selection is left alone.
  const [itemId, setItemId] = useState<MarketplaceItemId | null>(null)
  const openState = useMarketplaceOpenPage({
    pickedTarget: pickedTarget ?? null,
    hostKey: host.selectedKey,
    skillTarget,
    onOpenItem: setItemId
  })
  const { openPage, openRow, closePage } = openState
  const [query, setQuery] = useState('')

  useEffect(() => {
    void refreshApps()
  }, [refreshApps])

  const closeAll = useCallback((): void => {
    closePage()
    setItemId(null)
  }, [closePage])

  const onRowAction = (row: CatalogRow): void => {
    if (row.customId !== null && row.status.kind === 'action') {
      void catalog.installCustom(row.customId)
      return
    }
    openRow(row)
  }

  const item = MARKETPLACE_CATALOG.find((candidate) => candidate.id === itemId)
  if (item !== undefined) {
    return (
      <div className="flex min-w-0 flex-col">
        {item.id === 'git' ? (
          <MarketplaceDetail item={item} badgeState={catalog.badgeFor('git')} onBack={closeAll} />
        ) : (
          <MarketplaceAppPage appId={item.id} onBack={closeAll} />
        )}
      </div>
    )
  }
  if (openPage !== null) {
    return (
      <div className="flex min-w-0 flex-col">
        <MarketplaceOpenPageView
          state={openState}
          hostLabel={hostLabel}
          skillTarget={skillTarget}
        />
      </div>
    )
  }
  return (
    <MarketplaceCatalogList
      filter="all"
      sections={catalog.sections}
      query={query}
      onQueryChange={setQuery}
      onOpen={openRow}
      onAction={onRowAction}
    />
  )
}
