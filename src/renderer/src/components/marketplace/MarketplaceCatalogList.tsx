import { ChevronRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { MarketplaceSection } from '@/store/slices/ui/ui-slice-contract-core'
import { cn } from '@/lib/utils'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import {
  MARKETPLACE_CATALOG,
  type MarketplaceCatalogItem,
  type MarketplaceItemId
} from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'
import { MarketplaceAgentsSection } from './MarketplaceAgentsSection'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'
import { MarketplaceSkillsSection } from './MarketplaceSkillsSection'
import { MarketplaceStatusBadge } from './MarketplaceStatusBadge'

/** The main area for the sidebar's section: catalog rows, the agents list, or the skills list. */
export function MarketplaceCatalogList({
  section,
  badgeStateFor,
  onSelect,
  onSelectAgent
}: {
  section: MarketplaceSection
  badgeStateFor: (id: MarketplaceItemId) => MarketplaceBadgeState
  onSelect: (id: MarketplaceItemId) => void
  onSelectAgent: (agent: TuiAgent) => void
}): React.JSX.Element {
  return (
    <>
      <SectionBody
        section={section}
        badgeStateFor={badgeStateFor}
        onSelect={onSelect}
        onSelectAgent={onSelectAgent}
      />
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
  onSelect,
  onSelectAgent
}: {
  section: MarketplaceSection
  badgeStateFor: (id: MarketplaceItemId) => MarketplaceBadgeState
  onSelect: (id: MarketplaceItemId) => void
  onSelectAgent: (agent: TuiAgent) => void
}): React.JSX.Element {
  if (section === 'agents') {
    return <MarketplaceAgentsSection onSelect={onSelectAgent} />
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

/** Leaving the Skills section returns to the catalog, not out of the Marketplace. */
function SkillsSection(): React.JSX.Element {
  const setSection = useAppStore((s) => s.setMarketplaceSection)
  return <MarketplaceSkillsSection onClose={() => setSection('all')} />
}
