import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getProviderAccountScope } from '../settings/provider-account-scope'
import { ProviderHostScopeControl } from '../settings/ProviderHostScopeControl'
import { MarketplaceFunctionNote } from './MarketplaceFunctionNote'
import { MARKETPLACE_INTEGRATIONS, type MarketplaceIntegrationId } from './marketplace-integrations'

/** Who can use an integration: per-agent limits are not backed for integrations yet, so the line says so. */
export function MarketplaceIntegrationAccessNote({
  id
}: {
  id: MarketplaceIntegrationId
}): React.JSX.Element {
  return (
    <MarketplaceFunctionNote
      part="access"
      label={translate('auto.components.marketplace.MarketplaceAppAccess.title', 'Who can use it')}
    >
      {translate(
        'auto.components.marketplace.MarketplaceIntegrationAdvanced.accessLimit',
        'Limiting {{app}} per agent or bot team is not available yet.',
        { app: MARKETPLACE_INTEGRATIONS[id].name }
      )}
    </MarketplaceFunctionNote>
  )
}

/** Settings beyond connecting, open by default, like the app pages' Advanced options. */
export function MarketplaceIntegrationAdvanced({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div data-marketplace-section="advanced" className="flex flex-col gap-3">
      <Collapsible defaultOpen>
        <div className="flex min-h-7 items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">
            {translate(
              'auto.components.marketplace.MarketplaceAppAdvanced.title',
              'Advanced options'
            )}
          </h3>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={translate(
                'auto.components.marketplace.MarketplaceAppAdvanced.toggle',
                'Show or hide advanced options'
              )}
            >
              <ChevronDown />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="flex flex-col gap-4 pt-3">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/** Which runtime's accounts the connection uses; changing it happens under Remote Servers. */
export function MarketplaceIntegrationAccountScope(): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs">
      <ProviderHostScopeControl
        labelPrefix={translate(
          'auto.components.marketplace.MarketplaceIntegrationAdvanced.accountScope',
          'Account scope'
        )}
        scope={getProviderAccountScope(settings)}
      />
    </div>
  )
}
