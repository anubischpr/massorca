import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { MarketplaceSection } from '@/store/slices/ui/ui-slice-contract-core'
import { cn } from '@/lib/utils'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { MarketplaceAgentMark } from './marketplace-agent-mark'
import {
  MARKETPLACE_CATALOG,
  marketplaceAgentLabel,
  type MarketplaceCatalogItem,
  type MarketplaceItemId
} from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'
import { MarketplaceStatusBadge } from './MarketplaceStatusBadge'
import { useMarketplaceAgents } from './use-marketplace-agents'

/** The main area for the sidebar's section: catalog rows, the agents list, or the Skills link. */
export function MarketplaceCatalogList({
  section,
  badgeStateFor,
  onSelect
}: {
  section: MarketplaceSection
  badgeStateFor: (id: MarketplaceItemId) => MarketplaceBadgeState
  onSelect: (id: MarketplaceItemId) => void
}): React.JSX.Element {
  return (
    <>
      <SectionBody section={section} badgeStateFor={badgeStateFor} onSelect={onSelect} />
      <p className={cn(SKILLS_PAGE_COLUMN, 'py-4 text-xs text-muted-foreground')}>
        {translate(
          'auto.components.marketplace.MarketplaceCatalogList.footer',
          'Only this computer for now. SSH and WSL hosts come later.'
        )}
      </p>
    </>
  )
}

function SectionBody({
  section,
  badgeStateFor,
  onSelect
}: {
  section: MarketplaceSection
  badgeStateFor: (id: MarketplaceItemId) => MarketplaceBadgeState
  onSelect: (id: MarketplaceItemId) => void
}): React.JSX.Element {
  if (section === 'agents') {
    return <AgentsSection />
  }
  if (section === 'skills') {
    return <SkillsSection />
  }
  return (
    <ItemList items={itemsForSection(section)} badgeStateFor={badgeStateFor} onSelect={onSelect} />
  )
}

function itemsForSection(section: 'all' | 'tools' | 'services'): readonly MarketplaceCatalogItem[] {
  switch (section) {
    case 'tools':
      return MARKETPLACE_CATALOG.filter((item) => item.kind === 'tool')
    case 'services':
      return MARKETPLACE_CATALOG.filter((item) => item.kind === 'service')
    case 'all':
      return MARKETPLACE_CATALOG
  }
}

function ItemList({
  items,
  badgeStateFor,
  onSelect
}: {
  items: readonly MarketplaceCatalogItem[]
  badgeStateFor: (id: MarketplaceItemId) => MarketplaceBadgeState
  onSelect: (id: MarketplaceItemId) => void
}): React.JSX.Element {
  return (
    <ul className="border-t border-border">
      {items.map((item) => (
        <li key={item.id} className="border-b border-border">
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent md:px-8"
          >
            <MarketplaceItemIcon id={item.id} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{item.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {translate(item.description.key, item.description.fallback)}
              </span>
            </span>
            <MarketplaceStatusBadge state={badgeStateFor(item.id)} />
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

function AgentsSection(): React.JSX.Element {
  const agents = useMarketplaceAgents()
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex flex-col gap-3 py-3')}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {translate(
            'auto.components.marketplace.MarketplaceCatalogList.agentsTitle',
            'Agents on this computer'
          )}
        </p>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => {
            openSettingsTarget({ pane: 'agents', repoId: null })
            openSettingsPage()
          }}
        >
          {translate(
            'auto.components.marketplace.MarketplaceCatalogList.agentSettings',
            'Open Agents in Settings'
          )}
        </Button>
      </div>
      {agents === null ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.MarketplaceCatalogList.checking',
            'Checking this computer…'
          )}
        </p>
      ) : null}
      {agents?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.MarketplaceCatalogList.noAgents',
            'No agent is detected on this computer yet.'
          )}
        </p>
      ) : null}
      {agents && agents.length > 0 ? (
        <ul className="flex flex-col border-t border-border">
          {agents.map((agent) => (
            <li key={agent} className="flex items-center gap-3 border-b border-border py-2.5">
              <MarketplaceAgentMark agent={agent} size={16} />
              <span className="text-sm">{marketplaceAgentLabel(agent)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function SkillsSection(): React.JSX.Element {
  const openSkillsPage = useAppStore((s) => s.openSkillsPage)
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex flex-col items-start gap-2 py-3')}>
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceCatalogList.skillsHelp',
          'Skills are installed and shared on the Skills page.'
        )}
      </p>
      <Button type="button" variant="link" size="sm" onClick={openSkillsPage}>
        {translate('auto.components.marketplace.MarketplaceCatalogList.openSkills', 'Open Skills')}
      </Button>
    </div>
  )
}
