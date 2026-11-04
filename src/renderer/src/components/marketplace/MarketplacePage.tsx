import { useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { SkillInstallDialog } from '../skills/SkillInstallDialog'
import { MarketplaceAddCustomDialog } from './MarketplaceAddCustomDialog'
import { MarketplaceAgentPage } from './MarketplaceAgentPage'
import { MarketplaceAppPage } from './MarketplaceAppPage'
import { MarketplaceCatalogList } from './MarketplaceCatalogList'
import { useMarketplaceCatalog } from './MarketplaceCatalogData'
import type { CatalogRow } from './MarketplaceCatalogRows'
import { MarketplaceDetail } from './MarketplaceDetail'
import { MarketplaceHeader } from './MarketplaceHeader'
import { MarketplaceYourAppsPage } from './MarketplaceYourAppsPage'
import { MARKETPLACE_CATALOG } from './marketplace-catalog'
import { marketplaceHostKey } from './use-marketplace-host-targets'
import { useMarketplaceAppHost } from './use-marketplace-app-host'

export default function MarketplacePage(): React.JSX.Element {
  const section = useAppStore((s) => s.marketplaceSection)
  const selectedId = useAppStore((s) => s.marketplaceSelectedItemId)
  const selectItem = useAppStore((s) => s.selectMarketplaceItem)
  const refreshApps = useAppStore((s) => s.refreshMarketplaceApps)
  const openSkillsPage = useAppStore((s) => s.openSkillsPage)
  const host = useMarketplaceAppHost()
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
    apps: host.apps,
    refreshPreflight: true
  })
  const [agentId, setAgentId] = useState<TuiAgent | null>(null)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [skillLink, setSkillLink] = useState<string | null>(null)
  const selectedItem = MARKETPLACE_CATALOG.find((item) => item.id === selectedId)

  // Why: an agent page belongs to the Agents list it was opened from; a section or app change leaves it.
  useEffect(() => {
    setAgentId(null)
  }, [section, selectedId])

  useEffect(() => {
    void refreshApps()
  }, [refreshApps])

  const openRow = (row: CatalogRow): void => {
    const target = row.target
    if (target === null) {
      return
    }
    if (target.kind === 'item') {
      selectItem(target.id)
    } else if (target.kind === 'agent') {
      setAgentId(target.agent)
    } else {
      openSkillsPage()
    }
  }

  const onRowAction = (row: CatalogRow): void => {
    if (row.customId !== null && row.status.kind === 'action') {
      void catalog.installCustom(row.customId)
      return
    }
    openRow(row)
  }

  if (selectedItem !== undefined || agentId !== null) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-chat-canvas">
        <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
          {selectedItem === undefined ? (
            agentId !== null ? (
              <MarketplaceAgentPage agentId={agentId} onBack={() => setAgentId(null)} />
            ) : null
          ) : selectedItem.id === 'git' ? (
            <MarketplaceDetail
              item={selectedItem}
              badgeState={catalog.badgeFor('git')}
              onBack={() => selectItem(null)}
            />
          ) : (
            <MarketplaceAppPage appId={selectedItem.id} onBack={() => selectItem(null)} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-chat-canvas">
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        {section === 'your-apps' ? (
          <>
            <MarketplaceHeader
              title={translate(
                'auto.components.marketplace.MarketplaceSidebar.yourApps',
                'Your apps'
              )}
              host={host}
            />
            <MarketplaceYourAppsPage
              hostLabel={hostLabel}
              installed={catalog.installed}
              connected={catalog.connected}
              onOpen={openRow}
            />
          </>
        ) : (
          <>
            <MarketplaceHeader
              title={translate(
                'auto.components.marketplace.MarketplaceHeader.title',
                'Marketplace'
              )}
              host={host}
              onAddCustom={() => setAddOpen(true)}
            />
            <MarketplaceCatalogList
              filter={section}
              sections={catalog.sections}
              query={query}
              onQueryChange={setQuery}
              onOpen={openRow}
              onAction={onRowAction}
            />
          </>
        )}
      </div>
      <MarketplaceAddCustomDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onInstallSkillLink={setSkillLink}
      />
      {skillLink !== null ? (
        <SkillInstallDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setSkillLink(null)
            }
          }}
          initialLink={skillLink}
        />
      ) : null}
    </div>
  )
}
