import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { CatalogRowTile } from './MarketplaceCatalogItem'
import type { CatalogRow } from './MarketplaceCatalogRows'

/** Your apps: what is installed on the host shown, then the services connected to it. */
export function MarketplaceYourAppsPage({
  hostLabel,
  installed,
  connected,
  onOpen
}: {
  hostLabel: string
  installed: readonly CatalogRow[]
  connected: readonly CatalogRow[]
  onOpen: (row: CatalogRow) => void
}): React.JSX.Element {
  return (
    <div className="flex max-w-[1080px] flex-col gap-5 px-10 pb-10">
      <p className="-mt-2 text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceYourAppsPage.subtitle',
          'What is installed on each host, and the services you connected. Updates install by themselves.'
        )}
      </p>
      <h2 className="text-sm font-semibold">
        {translate('auto.components.marketplace.MarketplaceYourAppsPage.installed', 'Installed')}
      </h2>
      <div className="rounded-xl border border-border bg-card">
        {installed.length > 0 ? (
          installed.map((row) => (
            <YourAppRow key={row.key} row={row} secondary={hostLabel} onOpen={onOpen} />
          ))
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {translate(
              'auto.components.marketplace.MarketplaceYourAppsPage.noneInstalled',
              'Nothing is installed on {{host}} yet.',
              { host: hostLabel }
            )}
          </p>
        )}
      </div>
      <h2 className="text-sm font-semibold">
        {translate('auto.components.marketplace.MarketplaceYourAppsPage.connected', 'Connected')}
      </h2>
      <div className="rounded-xl border border-border bg-card">
        {connected.length > 0 ? (
          connected.map((row) => (
            <YourAppRow key={row.key} row={row} secondary={row.description} onOpen={onOpen} />
          ))
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {translate(
              'auto.components.marketplace.MarketplaceYourAppsPage.noneConnected',
              'No services are connected yet.'
            )}
          </p>
        )}
      </div>
    </div>
  )
}

function YourAppRow({
  row,
  secondary,
  onOpen
}: {
  row: CatalogRow
  secondary: string
  onOpen: (row: CatalogRow) => void
}): React.JSX.Element {
  const manage = row.status.kind === 'found' && row.target?.kind === 'agent'
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
      <CatalogRowTile icon={row.icon} />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{row.name}</span>
        {secondary ? (
          <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
        ) : null}
      </div>
      <Badge variant="secondary">
        {row.status.kind === 'found' ? (
          <span aria-hidden className="size-1.5 rounded-full bg-status-success" />
        ) : null}
        <span className={row.service ? 'text-status-success' : undefined}>{row.status.label}</span>
      </Badge>
      {row.target ? (
        <Button variant="outline" size="sm" onClick={() => onOpen(row)}>
          {manage
            ? translate(
                'auto.components.marketplace.MarketplaceYourAppsPage.manage',
                'Manage with MassOrca'
              )
            : translate('auto.components.marketplace.MarketplaceYourAppsPage.open', 'Open')}
        </Button>
      ) : null}
    </div>
  )
}
