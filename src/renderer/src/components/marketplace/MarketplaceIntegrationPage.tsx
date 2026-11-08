import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { useIntegrationProviderStatusRefresh } from '../settings/use-integration-provider-status-refresh'
import { MarketplacePageHostRow } from './MarketplacePageHostRow'
import { MarketplaceJiraIntegration } from './MarketplaceIntegrationJira'
import { MarketplaceLinearIntegration } from './MarketplaceIntegrationLinear'
import { MarketplaceRuntimeScopedIntegration } from './MarketplaceIntegrationRuntimeScoped'
import { MarketplaceServiceIntegration } from './MarketplaceIntegrationService'
import type { MarketplaceIntegrationId } from './marketplace-integrations'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import { useMarketplaceAppHost } from './use-marketplace-app-host'
import { marketplaceHostKey } from './use-marketplace-host-targets'

/** The page for a Settings integration: the same Banner, Connection, Advanced options and Danger zone as an app page. */
export function MarketplaceIntegrationPage({
  integration,
  onBack
}: {
  integration: MarketplaceIntegrationId
  onBack: () => void
}): React.JSX.Element {
  useIntegrationProviderStatusRefresh()
  const host = useMarketplaceAppHost()
  const target: MarketplaceVaultHostTarget | null =
    host.targets.find((candidate) => marketplaceHostKey(candidate) === host.selectedKey) ?? null
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex flex-col gap-6 py-4')}>
      <MarketplacePageHostRow host={host}>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          {translate('auto.components.marketplace.MarketplaceAppPage.back', 'Back')}
        </Button>
      </MarketplacePageHostRow>
      <IntegrationBody integration={integration} target={target} />
    </div>
  )
}

function IntegrationBody({
  integration,
  target
}: {
  integration: MarketplaceIntegrationId
  target: MarketplaceVaultHostTarget | null
}): React.JSX.Element {
  switch (integration) {
    case 'gitlab':
    case 'bitbucket':
    case 'azure-devops':
    case 'gitea':
      // Why: keyed by host so a page never keeps the previous host's dialog or answer.
      return (
        <MarketplaceServiceIntegration
          key={target === null ? 'local' : marketplaceHostKey(target)}
          service={integration}
          target={target}
        />
      )
    case 'linear':
      return target === null ? (
        <MarketplaceLinearIntegration />
      ) : (
        <MarketplaceRuntimeScopedIntegration id="linear" target={target} />
      )
    case 'jira':
      return target === null ? (
        <MarketplaceJiraIntegration />
      ) : (
        <MarketplaceRuntimeScopedIntegration id="jira" target={target} />
      )
  }
}
