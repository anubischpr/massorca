import { translate } from '@/i18n/i18n'
import type { MarketplaceAppMention } from '../../../../shared/marketplace-app-mentions'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'

/** An installed app's row in an @ menu: its logo, name and where it came from. */
export function MarketplaceAppMentionRow({
  app
}: {
  app: MarketplaceAppMention
}): React.JSX.Element {
  return (
    <>
      <MarketplaceItemIcon id={app.id} className="mt-0.5 size-3.5" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{app.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {translate(
            'components.marketplace.installedFromMarketplace',
            'Installed from Marketplace'
          )}
        </span>
      </span>
    </>
  )
}
