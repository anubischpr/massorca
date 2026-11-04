import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { MarketplaceAppId } from '../../../../shared/marketplace-apps'
import { MARKETPLACE_APP_INFO } from './marketplace-app-info'
import { copyMarketplaceText } from './marketplace-clipboard'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'

// Why: tokens mixed into card keep light and dark aligned; main.css has no success token.
const BANNER_STYLE = {
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--ai-action-accent) 12%, var(--card)), color-mix(in srgb, var(--primary) 6%, var(--card)))'
}

/** Example prompts for one app; each chip names the app, and each arrow copies the prompt with its @ mention. */
export function MarketplaceAppBanner({ appId }: { appId: MarketplaceAppId }): React.JSX.Element {
  const { name, prompts } = MARKETPLACE_APP_INFO[appId]
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4" style={BANNER_STYLE}>
      {prompts.map((prompt) => {
        const text = translate(prompt.key, prompt.fallback)
        return (
          <div
            key={prompt.key}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <Badge variant="secondary" className="shrink-0">
              <MarketplaceItemIcon id={appId} className="text-foreground" />
              {name}
            </Badge>
            <span className="min-w-0 flex-1 truncate text-sm">{text}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={translate(
                'auto.components.marketplace.MarketplaceAppBanner.copyPrompt',
                'Copy this prompt'
              )}
              onClick={() => void copyMarketplaceText(`@${name} ${text}`)}
            >
              <ArrowRight />
            </Button>
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceAppBanner.hint',
          'Type @{{app}} in any chat or room to ask it directly.',
          { app: name }
        )}
      </p>
    </div>
  )
}
