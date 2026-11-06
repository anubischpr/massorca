import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { copyMarketplaceText } from './marketplace-clipboard'
import { MarketplaceIntegrationIcon } from './MarketplaceIntegrationIcon'
import { MARKETPLACE_INTEGRATIONS, type MarketplaceIntegrationId } from './marketplace-integrations'

// Why: the same tokens as the app banner, so every Marketplace page opens with one look.
const BANNER_STYLE = {
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--ai-action-accent) 12%, var(--card)), color-mix(in srgb, var(--primary) 6%, var(--card)))'
}

/** Example prompts for one integration; each arrow copies its prompt. */
export function MarketplaceIntegrationBanner({
  id
}: {
  id: MarketplaceIntegrationId
}): React.JSX.Element {
  const { name, prompts } = MARKETPLACE_INTEGRATIONS[id]
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
              <MarketplaceIntegrationIcon id={id} className="text-foreground" />
              {name}
            </Badge>
            <span className="min-w-0 flex-1 truncate text-sm">{text}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={translate(
                'auto.components.marketplace.MarketplaceIntegrationBanner.copyPrompt',
                'Copy this prompt'
              )}
              onClick={() => void copyMarketplaceText(text)}
            >
              <ArrowRight />
            </Button>
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.marketplace.MarketplaceIntegrationBanner.hint',
          'Things to ask once {{app}} is connected.',
          { app: name }
        )}
      </p>
    </div>
  )
}
