import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useActiveSkillDiscoveryRuntimeTarget } from '@/hooks/use-active-skill-discovery-runtime-target'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { useIntegrationProviderStatusRefresh } from '../settings/use-integration-provider-status-refresh'
import { skillAgentByRootPath } from '../skills/skill-agent-filter'
import { SkillInstallDialog } from '../skills/SkillInstallDialog'
import { MarketplaceAddCustomDialog } from './MarketplaceAddCustomDialog'
import { MarketplaceAgentPage } from './MarketplaceAgentPage'
import { MarketplaceAppPage } from './MarketplaceAppPage'
import { MarketplaceCatalogList } from './MarketplaceCatalogList'
import { useMarketplaceCatalog } from './MarketplaceCatalogData'
import type { CatalogRow } from './MarketplaceCatalogRows'
import { MarketplaceDetail } from './MarketplaceDetail'
import { MarketplaceHeader } from './MarketplaceHeader'
import { MarketplaceIntegrationPage } from './MarketplaceIntegrationPage'
import { MarketplaceSkillBuiltInPage } from './MarketplaceSkillBuiltInPage'
import { MarketplaceSkillPage } from './MarketplaceSkillPage'
import {
  marketplaceSkillPageFromScan,
  type MarketplaceSkillListing,
  type MarketplaceSkillPageData
} from './MarketplaceSkillPageModel'
import { MarketplaceYourAppsPage } from './MarketplaceYourAppsPage'
import { BUILT_IN_SKILL_COMMANDS, type BuiltInSkillCommand } from './marketplace-skill-built-in'
import { clearSkillRowOpenRequest, useSkillRowOpenRequest } from './marketplace-skill-open-request'
import { MARKETPLACE_CATALOG } from './marketplace-catalog'
import { discoverSkillsForPickedHost } from './marketplace-skill-host-scan'
import type { MarketplaceIntegrationId } from './marketplace-integrations'
import { marketplaceHostKey } from './use-marketplace-host-targets'
import { useMarketplaceAppHost } from './use-marketplace-app-host'

/** A page a list opened: an agent, a Settings integration, a built-in command, or a skill with the copies its page reads. */
type OpenPage =
  | { kind: 'agent'; agent: TuiAgent }
  | { kind: 'integration'; id: MarketplaceIntegrationId }
  | { kind: 'built-in'; command: BuiltInSkillCommand }
  | { kind: 'skill'; listing: MarketplaceSkillListing; page: MarketplaceSkillPageData }

function reportSkillOpenFailed(): void {
  toast.error(
    translate(
      'auto.components.marketplace.MarketplacePage.skillOpenFailed',
      'Could not open this skill.'
    )
  )
}

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
  const [openPage, setOpenPage] = useState<OpenPage | null>(null)
  // Why: a skill page opens after its scan, so a later open or a section change must cancel it.
  const openRequest = useRef(0)
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [skillLink, setSkillLink] = useState<string | null>(null)
  const selectedItem = MARKETPLACE_CATALOG.find((item) => item.id === selectedId)

  // Why: a page belongs to the list it was opened from; a section or app change leaves it.
  useEffect(() => {
    openRequest.current += 1
    setOpenPage(null)
  }, [section, selectedId])

  useEffect(() => {
    void refreshApps()
  }, [refreshApps])

  // Why: the Services rows read the Settings checks, which nothing else refreshes while Marketplace is open.
  useIntegrationProviderStatusRefresh()

  // Why: the catalog keeps only the skill list, so the page takes one fresh scan for the copies it shows.
  // Why: a picked host's page scans that host; this computer keeps scanning the focused runtime.
  const openSkillPage = useCallback(
    (listing: MarketplaceSkillListing): void => {
      const scan = discoverSkillsForPickedHost(pickedTarget ?? null, skillTarget)
      if (scan === null) {
        if (pickedTarget !== undefined) {
          reportSkillOpenFailed()
        }
        return
      }
      const request = ++openRequest.current
      void scan.then(
        (result) => {
          if (request !== openRequest.current) {
            return
          }
          const page = marketplaceSkillPageFromScan(
            listing,
            result.skills,
            skillAgentByRootPath(result)
          )
          if (page === null) {
            reportSkillOpenFailed()
            return
          }
          setOpenPage({ kind: 'skill', listing, page })
        },
        () => {
          if (request === openRequest.current) {
            reportSkillOpenFailed()
          }
        }
      )
    },
    [pickedTarget, skillTarget]
  )

  // Why: the open skill page's host picker moves its scan to the newly picked host, so it is read again.
  const openPageRef = useRef<OpenPage | null>(null)
  useEffect(() => {
    openPageRef.current = openPage
  }, [openPage])
  const scannedHostKey = useRef(host.selectedKey)
  useEffect(() => {
    if (scannedHostKey.current === host.selectedKey) {
      return
    }
    scannedHostKey.current = host.selectedKey
    const open = openPageRef.current
    if (open?.kind === 'skill') {
      setOpenPage(null)
      openSkillPage(open.listing)
    }
  }, [host.selectedKey, openSkillPage])

  const openRow = useCallback(
    (row: CatalogRow): void => {
      const target = row.target
      if (target === null) {
        return
      }
      if (target.kind === 'skill') {
        openSkillPage({ kind: 'discovered', skill: target.skill })
        return
      }
      if (target.kind === 'custom-skill') {
        openSkillPage({ kind: 'custom', item: target.item })
        return
      }
      openRequest.current += 1
      if (target.kind === 'item') {
        selectItem(target.id)
      } else if (target.kind === 'integration') {
        setOpenPage({ kind: 'integration', id: target.id })
      } else if (target.kind === 'built-in') {
        setOpenPage({ kind: 'built-in', command: BUILT_IN_SKILL_COMMANDS[target.id] })
      } else {
        setOpenPage({ kind: 'agent', agent: target.agent })
      }
    },
    [openSkillPage, selectItem]
  )

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

  // Why: a scan still in flight, such as the rescan a removal starts, must not reopen the page it left.
  const closePage = (): void => {
    openRequest.current += 1
    setOpenPage(null)
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
        {openPage.kind === 'agent' ? (
          <MarketplaceAgentPage agentId={openPage.agent} onBack={closePage} />
        ) : openPage.kind === 'integration' ? (
          <MarketplaceIntegrationPage integration={openPage.id} onBack={closePage} />
        ) : openPage.kind === 'built-in' ? (
          <MarketplaceSkillBuiltInPage command={openPage.command} onBack={closePage} />
        ) : (
          <MarketplaceSkillPage
            skill={openPage.page.skill}
            copies={openPage.page.copies}
            hostName={hostLabel}
            focusedRuntime={skillTarget}
            onBack={closePage}
            onRescan={() => openSkillPage(openPage.listing)}
          />
        )}
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
