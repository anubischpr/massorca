import { translate } from '@/i18n/i18n'
import { MarketplaceIntegrationAccountScope } from './MarketplaceIntegrationAdvanced'
import { MarketplaceIntegrationLayout } from './MarketplaceIntegrationLayout'
import { notOnHostMessage } from './marketplace-integration-service-copy'
import { MARKETPLACE_INTEGRATIONS, type MarketplaceIntegrationId } from './marketplace-integrations'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'

/**
 * Linear and Jira follow the account scope MassOrca runs in, not a host picked on the page, so
 * another host shows that plainly instead of this computer's connection.
 */
export function MarketplaceRuntimeScopedIntegration({
  id,
  target
}: {
  id: MarketplaceIntegrationId
  target: MarketplaceVaultHostTarget
}): React.JSX.Element {
  return (
    <MarketplaceIntegrationLayout
      id={id}
      state="unavailable"
      connection={
        <p className="text-sm">
          {target.kind === 'wsl'
            ? notOnHostMessage('wsl')
            : translate(
                'auto.components.marketplace.MarketplaceIntegrationRuntimeScoped.body',
                '{{app}} connects through the account scope MassOrca is using, not per host. Pick This computer to manage it, or change the scope under Remote Servers.',
                { app: MARKETPLACE_INTEGRATIONS[id].name }
              )}
        </p>
      }
      advanced={<MarketplaceIntegrationAccountScope />}
      disconnects={[]}
    />
  )
}
