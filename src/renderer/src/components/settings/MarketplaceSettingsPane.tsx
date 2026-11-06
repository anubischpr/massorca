import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useActiveSkillDiscoveryRuntimeTarget } from '@/hooks/use-active-skill-discovery-runtime-target'
import { translate } from '@/i18n/i18n'
import { discoverSkillsForRuntimeTarget } from '@/runtime/runtime-skills-client'
import { useAppStore } from '@/store'
import type { DiscoveredSkill } from '../../../../shared/skills'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { skillAgentByRootPath } from '../skills/skill-agent-filter'
import { MarketplaceAgentPage } from '../marketplace/MarketplaceAgentPage'
import { MarketplaceAppPage } from '../marketplace/MarketplaceAppPage'
import { useMarketplaceCatalog } from '../marketplace/MarketplaceCatalogData'
import { MarketplaceCatalogList } from '../marketplace/MarketplaceCatalogList'
import type { CatalogRow } from '../marketplace/MarketplaceCatalogRows'
import { MarketplaceDetail } from '../marketplace/MarketplaceDetail'
import { MARKETPLACE_CATALOG } from '../marketplace/marketplace-catalog'
import {
  marketplaceSkillFromDiscovered,
  type MarketplaceSkillPageSkill
} from '../marketplace/MarketplaceSkillPageModel'
import { MarketplaceSkillPage } from '../marketplace/MarketplaceSkillPage'
import { useMarketplaceAppHost } from '../marketplace/use-marketplace-app-host'
import { marketplaceHostKey } from '../marketplace/use-marketplace-host-targets'

type OpenPage =
  | { kind: 'item'; item: (typeof MARKETPLACE_CATALOG)[number] }
  | { kind: 'agent'; agent: TuiAgent }
  | { kind: 'skill'; skill: MarketplaceSkillPageSkill }

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
    apps: host.apps,
    refreshPreflight: true
  })
  const [openPage, setOpenPage] = useState<OpenPage | null>(null)
  const [query, setQuery] = useState('')
  // Why: a skill page opens after its scan, so a later open or close must cancel it.
  const openRequest = useRef(0)

  useEffect(() => {
    void refreshApps()
  }, [refreshApps])

  const closePage = (): void => {
    openRequest.current += 1
    setOpenPage(null)
  }

  const openSkill = (listed: DiscoveredSkill): void => {
    if (skillTarget === null) {
      return
    }
    const request = ++openRequest.current
    void discoverSkillsForRuntimeTarget(skillTarget).then(
      (result) => {
        const skill = result.skills.find((candidate) => candidate.id === listed.id)
        if (request === openRequest.current && skill !== undefined) {
          setOpenPage({
            kind: 'skill',
            skill: marketplaceSkillFromDiscovered(skill, skillAgentByRootPath(result))
          })
        }
      },
      () => {
        if (request === openRequest.current) {
          toast.error(
            translate(
              'auto.components.marketplace.MarketplacePage.skillOpenFailed',
              'Could not open this skill.'
            )
          )
        }
      }
    )
  }

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
    if (target.kind === 'agent') {
      setOpenPage({ kind: 'agent', agent: target.agent })
      return
    }
    const item = MARKETPLACE_CATALOG.find((candidate) => candidate.id === target.id)
    if (item !== undefined) {
      setOpenPage({ kind: 'item', item })
    }
  }

  const onRowAction = (row: CatalogRow): void => {
    if (row.customId !== null && row.status.kind === 'action') {
      void catalog.installCustom(row.customId)
      return
    }
    openRow(row)
  }

  if (openPage === null) {
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
  if (openPage.kind === 'agent') {
    return (
      <div className="flex min-w-0 flex-col">
        <MarketplaceAgentPage agentId={openPage.agent} onBack={closePage} />
      </div>
    )
  }
  if (openPage.kind === 'skill') {
    return (
      <div className="flex min-w-0 flex-col">
        <MarketplaceSkillPage skill={openPage.skill} hostName={hostLabel} onBack={closePage} />
      </div>
    )
  }
  const item = openPage.item
  return (
    <div className="flex min-w-0 flex-col">
      {item.id === 'git' ? (
        <MarketplaceDetail item={item} badgeState={catalog.badgeFor('git')} onBack={closePage} />
      ) : (
        <MarketplaceAppPage appId={item.id} onBack={closePage} />
      )}
    </div>
  )
}
