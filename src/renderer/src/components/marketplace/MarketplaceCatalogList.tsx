import { Fragment } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { MarketplaceCatalogItem } from './MarketplaceCatalogItem'
import {
  rowMatchesQuery,
  type CatalogRow,
  type CatalogSection,
  type MarketplaceCatalogFilter
} from './MarketplaceCatalogRows'

/** The catalog body: the subtitle, the search field, then each section as a heading over a two-column grid. */
export function MarketplaceCatalogList({
  filter,
  sections,
  query,
  onQueryChange,
  onOpen,
  onAction
}: {
  filter: MarketplaceCatalogFilter
  sections: readonly CatalogSection[]
  query: string
  onQueryChange: (query: string) => void
  onOpen: (row: CatalogRow) => void
  onAction: (row: CatalogRow) => void
}): React.JSX.Element {
  const visible = sections.filter((section) => filter === 'all' || section.id === filter)
  return (
    <div className="flex max-w-[1080px] flex-col gap-5 px-10 pb-10">
      <p className="-mt-2 text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceCatalogList.subtitle',
          'Install the tools, agents and skills MassOrca uses on each host, and connect the services your agents and teams work with.'
        )}
      </p>
      <div className="flex min-w-0 items-center gap-2">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          placeholder={translate(
            'auto.components.marketplace.MarketplaceCatalogList.search',
            'Search'
          )}
          aria-label={translate(
            'auto.components.marketplace.MarketplaceCatalogList.searchLabel',
            'Search the Marketplace'
          )}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      {visible.map((section) => {
        const rows = section.rows.filter((row) => rowMatchesQuery(row, query))
        return (
          <Fragment key={section.id}>
            <div className="flex items-baseline gap-2 border-t border-border pt-4">
              <h2 className="text-sm font-semibold">{section.name}</h2>
              <span className="text-xs text-muted-foreground">{rows.length}</span>
              <span className="grow" />
              <span className="text-xs text-muted-foreground">{section.note}</span>
            </div>
            {rows.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {rows.map((row) => (
                  <MarketplaceCatalogItem
                    key={row.key}
                    row={row}
                    onOpen={onOpen}
                    onAction={onAction}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {section.placeholder ??
                  translate(
                    'auto.components.marketplace.MarketplaceCatalogList.noMatches',
                    'Nothing matches this search.'
                  )}
              </p>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
