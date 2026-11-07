import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useActiveSkillDiscoveryRuntimeTarget } from '@/hooks/use-active-skill-discovery-runtime-target'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { DiscoveredSkill } from '../../../../shared/skills'
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
import type { MarketplaceIntegrationId } from './marketplace-integrations'
import { MarketplaceSkillPage } from './MarketplaceSkillPage'
import {
  marketplaceSkillFromDiscovered,
  type MarketplaceSkillPageSkill
} from './MarketplaceSkillPageModel'
import { MarketplaceYourAppsPage } from './MarketplaceYourAppsPage'
import { MARKETPLACE_CATALOG } from './marketplace-catalog'
import { discoverSkillsForPickedHost } from './marketplace-skill-host-scan'
import { marketplaceHostKey } from './use-marketplace-host-targets'
import { useMarketplaceAppHost } from './use-marketplace-app-host'

/** A page a list opened: an agent, a Settings integration, or a skill with the copy its page reads. */
type OpenPage =
  | { kind: 'agent'; agent: TuiAgent }
  | { kind: 'integration'; id: MarketplaceIntegrationId }
  | { kind: 'skill'; skill: MarketplaceSkillPageSkill; listed: DiscoveredSkill }

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

  // Why: the catalog keeps only the skill list, so the page takes one fresh scan for the agents that hold it.
  // Why: a picked host's page scans that host; this computer keeps scanning the focused runtime.
  const openSkill = useCallback(
    (listed: DiscoveredSkill): void => {
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
          const skill = result.skills.find((candidate) => candidate.id === listed.id)
          if (request === openRequest.current && skill !== undefined) {
            setOpenPage({
              kind: 'skill',
              listed,
              skill: marketplaceSkillFromDiscovered(skill, skillAgentByRootPath(result))
            })
          }
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
      openSkill(open.listed)
    }
  }, [host.selectedKey, openSkill])

  const openRow = (row: CatalogRow): void => {
    const target = row.target
    if (target === null) {
      return
    }
    if (target.kind === 'skill') {
      openSkill(target.skill)
      return
    }
    openRequest.current += 1
    if (target.kind === 'item') {
      selectItem(target.id)
    } else if (target.kind === 'integration') {
      setOpenPage({ kind: 'integration', id: target.id })
    } else {
      setOpenPage({ kind: 'agent', agent: target.agent })
    }
  }

  const onRowAction = (row: CatalogRow): void => {
    if (row.customId !== null && row.status.kind === 'action') {
      void catalog.installCustom(row.customId)
      return
    }
    openRow(row)
  }

  const closePage = (): void => setOpenPage(null)

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
        ) : (
          <MarketplaceSkillPage
            skill={openPage.skill}
            hostName={hostLabel}
            onBack={closePage}
            onRescan={() => openSkill(openPage.listed)}
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
