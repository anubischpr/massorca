import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import { MarketplaceIntegrationIcon } from './MarketplaceIntegrationIcon'
import {
  MARKETPLACE_INTEGRATIONS,
  type MarketplaceIntegrationId,
  type MarketplaceIntegrationState
} from './marketplace-integrations'

function stateLabel(state: Exclude<MarketplaceIntegrationState, 'checking'>): string {
  switch (state) {
    case 'connected':
      return translate(
        'auto.components.marketplace.MarketplaceIntegrationHeader.connected',
        'Connected'
      )
    case 'unavailable':
      return translate(
        'auto.components.marketplace.MarketplaceIntegrationHeader.unavailable',
        'Unavailable'
      )
    case 'not-connected':
      return translate(
        'auto.components.marketplace.MarketplaceIntegrationHeader.notConnected',
        'Not connected'
      )
  }
}

/** Logo tile, name, status chip, tagline and the page's one primary action, as on the app pages. */
export function MarketplaceIntegrationHeader({
  id,
  state,
  action
}: {
  id: MarketplaceIntegrationId
  state: MarketplaceIntegrationState
  action?: React.ReactNode
}): React.JSX.Element {
  const info = MARKETPLACE_INTEGRATIONS[id]
  return (
    <header className="flex items-start gap-4">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary">
        <MarketplaceIntegrationIcon id={id} className="size-6 text-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{info.name}</h2>
          {state === 'checking' ? null : (
            <Badge variant={state === 'connected' ? 'secondary' : 'outline'}>
              {stateLabel(state)}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {translate(info.tagline.key, info.tagline.fallback)}
        </p>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  )
}
