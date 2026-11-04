import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import type { MarketplaceBadgeState } from './marketplace-status'

type BadgeCopy = { label: string; variant: 'secondary' | 'outline' | 'destructive' }

function badgeCopy(state: MarketplaceBadgeState): BadgeCopy {
  switch (state) {
    case 'checking':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.checking',
          'Checking…'
        ),
        variant: 'outline'
      }
    case 'unknown':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.unknown',
          'Could not check'
        ),
        variant: 'outline'
      }
    case 'installed':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.installed',
          'Installed'
        ),
        variant: 'secondary'
      }
    case 'not-installed':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.notInstalled',
          'Not installed'
        ),
        variant: 'outline'
      }
    case 'signed-in':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.signedIn',
          'Signed in'
        ),
        variant: 'secondary'
      }
    case 'not-signed-in':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.notSignedIn',
          'Not signed in'
        ),
        variant: 'outline'
      }
    case 'connected':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.connected',
          'Connected'
        ),
        variant: 'secondary'
      }
    case 'not-connected':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.notConnected',
          'Not connected'
        ),
        variant: 'outline'
      }
    case 'desktop-only':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.desktopOnly',
          'Available in the desktop app'
        ),
        variant: 'outline'
      }
  }
}

export function MarketplaceStatusBadge({
  state
}: {
  state: MarketplaceBadgeState
}): React.JSX.Element {
  const copy = badgeCopy(state)
  return (
    <Badge variant={copy.variant} className="shrink-0">
      {copy.label}
    </Badge>
  )
}
