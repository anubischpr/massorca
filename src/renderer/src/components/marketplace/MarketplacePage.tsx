import { useEffect, useState } from 'react'
import { useActiveSkillDiscoveryRuntimeTarget } from '@/hooks/use-active-skill-discovery-runtime-target'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useIntegrationProviderStatusRefresh } from '../settings/use-integration-provider-status-refresh'
import { SkillInstallDialog } from '../skills/SkillInstallDialog'
import { MarketplaceAddCustomDialog } from './MarketplaceAddCustomDialog'
import { MarketplaceAppPage } from './MarketplaceAppPage'
import { MarketplaceCatalogList } from './MarketplaceCatalogList'
import { useMarketplaceCatalog } from './MarketplaceCatalogData'
import type { CatalogRow } from './MarketplaceCatalogRows'
import { MarketplaceDetail } from './MarketplaceDetail'
import { MarketplaceHeader } from './MarketplaceHeader'
import { MarketplaceOpenPageView } from './MarketplaceOpenPageView'
import { MarketplaceYourAppsPage } from './MarketplaceYourAppsPage'
import { clearSkillRowOpenRequest, useSkillRowOpenRequest } from './marketplace-skill-open-request'
import { MARKETPLACE_CATALOG } from './marketplace-catalog'
import { marketplaceHostKey } from './use-marketplace-host-targets'
import { useMarketplaceAppHost } from './use-marketplace-app-host'
import { useMarketplaceOpenPage } from './use-marketplace-open-page'

export default function MarketplacePage(): React.JSX.Element {
  const section = useAppStore((s) => s.marketplaceSection)
  const selectedId = useAppStore((s) => s.marketplaceSelectedItemId)
  const selectItem = useAppStore((s) => s.selectMarketplaceItem)
  const refreshApps = useAppStore((s) => s.refreshMarketplaceApps)
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
  const openState = useMarketplaceOpenPage({
    pickedTarget: pickedTarget ?? null,
    hostKey: host.selectedKey,
    skillTarget,
    onOpenItem: selectItem
  })
  const { openPage, openRow, closePage } = openState
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [skillLink, setSkillLink] = useState<string | null>(null)
  const selectedItem = MARKETPLACE_CATALOG.find((item) => item.id === selectedId)

  // Why: a page belongs to the list it was opened from; a section or app change leaves it.
  useEffect(() => {
    closePage()
  }, [section, selectedId, closePage])

  useEffect(() => {
    void refreshApps()
  }, [refreshApps])

  // Why: the Services rows read the Settings checks, which nothing else refreshes while Marketplace is open.
  useIntegrationProviderStatusRefresh()

  // Why: the sidebar cannot scan skills itself, so it hands over the row it opened and the page opens it here.
  const skillRowRequest = useSkillRowOpenRequest()
  useEffect(() => {
    if (skillRowRequest === null) {
      return
    }
    clearSkillRowOpenRequest()
    openRow(skillRowRequest.row)
  }, [skillRowRequest, openRow])

  const onRowAction = (row: CatalogRow): void => {
    if (row.customId !== null && row.status.kind === 'action') {
      void catalog.installCustom(row.customId)
      return
    }
    openRow(row)
  }

  if (selectedItem !== undefined) {
    return (
      <PageFrame>
        {selectedItem.id === 'git' ? (
          <MarketplaceDetail
            item={selectedItem}
            badgeState={catalog.badgeFor('git')}
            onBack={() => selectItem(null)}
          />
        ) : (
          <MarketplaceAppPage appId={selectedItem.id} onBack={() => selectItem(null)} />
        )}
      </PageFrame>
    )
  }

  if (openPage !== null) {
    return (
      <PageFrame>
        <MarketplaceOpenPageView
          state={openState}
          hostLabel={hostLabel}
          skillTarget={skillTarget}
        />
      </PageFrame>
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
            {host.wslDistro === null ? (
              <MarketplaceYourAppsPage
                hostLabel={hostLabel}
                installed={catalog.installed}
                connected={catalog.connected}
                onOpen={openRow}
              />
            ) : (
              // Why: a WSL distro's apps cannot be read yet, so no list of them is claimed.
              <div className="flex max-w-[1080px] flex-col gap-5 px-10 pb-10">
                <p className="text-sm text-muted-foreground">
                  {translate(
                    'auto.components.marketplace.MarketplacePage.wslNotAvailable',
                    'Not available on WSL yet'
                  )}
                </p>
              </div>
            )}
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

/** The frame every opened page sits in: the canvas, scrolled as one column. */
function PageFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-chat-canvas">
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
