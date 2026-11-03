import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { MARKETPLACE_CATALOG, type MarketplaceItemId } from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'
import { MarketplaceStatusBadge } from './MarketplaceStatusBadge'

const SECTION_FILTERS = ['all', 'tool', 'service'] as const
type MarketplaceSectionFilter = (typeof SECTION_FILTERS)[number]

function parseSectionFilter(value: string): MarketplaceSectionFilter {
  // Why: Radix reports '' when the active item is pressed again; the list falls back to all.
  return SECTION_FILTERS.find((filter) => filter === value) ?? 'all'
}

export function MarketplaceCatalogList({
  badgeStateFor,
  onSelect
}: {
  badgeStateFor: (id: MarketplaceItemId) => MarketplaceBadgeState
  onSelect: (id: MarketplaceItemId) => void
}): React.JSX.Element {
  const [filter, setFilter] = useState<MarketplaceSectionFilter>('all')
  const items = MARKETPLACE_CATALOG.filter((item) => filter === 'all' || item.kind === filter)

  return (
    <>
      <div className={cn(SKILLS_PAGE_COLUMN, 'py-3')}>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={1}
          value={filter}
          onValueChange={(value) => setFilter(parseSectionFilter(value))}
          aria-label={translate(
            'auto.components.marketplace.MarketplaceCatalogList.filter',
            'Filter by section'
          )}
        >
          <ToggleGroupItem value="all">
            {translate('auto.components.marketplace.MarketplaceCatalogList.all', 'All')}
          </ToggleGroupItem>
          <ToggleGroupItem value="tool">
            {translate('auto.components.marketplace.MarketplaceCatalogList.tools', 'Tools')}
          </ToggleGroupItem>
          <ToggleGroupItem value="service">
            {translate('auto.components.marketplace.MarketplaceCatalogList.services', 'Services')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
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
      <p className={cn(SKILLS_PAGE_COLUMN, 'py-4 text-xs text-muted-foreground')}>
        {translate(
          'auto.components.marketplace.MarketplaceCatalogList.footer',
          'Only this computer for now. SSH and WSL hosts come later.'
        )}
      </p>
    </>
  )
}
