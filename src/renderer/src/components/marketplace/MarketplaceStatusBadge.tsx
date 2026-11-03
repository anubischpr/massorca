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
    case 'set':
      return {
        label: translate('auto.components.marketplace.MarketplaceStatusBadge.set', 'Set'),
        variant: 'secondary'
      }
    case 'partly-set':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.partlySet',
          'Partly set'
        ),
        variant: 'secondary'
      }
    case 'not-set':
      return {
        label: translate('auto.components.marketplace.MarketplaceStatusBadge.notSet', 'Not set'),
        variant: 'outline'
      }
    case 'unreadable':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.unreadable',
          'Settings file could not be read'
        ),
        variant: 'destructive'
      }
    case 'desktop-only':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.desktopOnly',
          'Available in the desktop app'
        ),
        variant: 'outline'
      }
    case 'coming-soon':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.comingSoon',
          'Coming soon'
        ),
        variant: 'outline'
      }
    case 'not-supported':
      return {
        label: translate(
          'auto.components.marketplace.MarketplaceStatusBadge.notSupported',
          'Not supported yet'
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
