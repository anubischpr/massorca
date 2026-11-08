import { Link2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { isMarketplaceAgentEntryMissing } from '../../../../shared/marketplace-apps'
import type { MarketplaceAppContext } from './marketplace-app-context'
import { copyMarketplaceText } from './marketplace-clipboard'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'

/** Logo tile, name, status chip, tagline, and the Copy link and Connect actions, as on the board. */
export function MarketplaceAppHeader({ ctx }: { ctx: MarketplaceAppContext }): React.JSX.Element {
  const { appId, info, status } = ctx
  // Why: a connected app keeps Connect while an installed agent lacks its entry, so the same action fills it in.
  const offerConnect =
    ctx.canConnect ||
    (ctx.ready && status.agents.some((agent) => isMarketplaceAgentEntryMissing(appId, agent)))
  return (
    <header className="flex items-start gap-4">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary">
        <MarketplaceItemIcon id={appId} className="size-6 text-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{info.name}</h2>
          {ctx.ready ? (
            <Badge variant={status.connected ? 'secondary' : 'outline'}>
              {status.connected
                ? translate(
                    'auto.components.marketplace.MarketplaceAppHeader.connected',
                    'Connected'
                  )
                : translate(
                    'auto.components.marketplace.MarketplaceAppHeader.notConnected',
                    'Not connected'
                  )}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {translate(info.tagline.key, info.tagline.fallback)}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void copyMarketplaceText(`massorca://marketplace/${appId}`)}
        >
          <Link2 />
          {translate('auto.components.marketplace.MarketplaceAppHeader.copyLink', 'Copy link')}
        </Button>
        {offerConnect ? (
          <Button type="button" size="sm" disabled={ctx.connectBlocked} onClick={ctx.connect}>
            {translate('auto.components.marketplace.MarketplaceAppHeader.connect', 'Connect')}
          </Button>
        ) : null}
      </div>
    </header>
  )
}
