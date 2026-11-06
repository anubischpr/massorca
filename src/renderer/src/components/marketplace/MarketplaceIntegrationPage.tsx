import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { SKILLS_PAGE_COLUMN } from '../skills/skills-page-column'
import { useIntegrationProviderStatusRefresh } from '../settings/use-integration-provider-status-refresh'
import { MarketplaceBitbucketIntegration } from './MarketplaceIntegrationBitbucket'
import {
  MarketplaceGitLabIntegration,
  MarketplaceTokenIntegration
} from './MarketplaceIntegrationSourceControl'
import { MarketplaceJiraIntegration } from './MarketplaceIntegrationJira'
import { MarketplaceLinearIntegration } from './MarketplaceIntegrationLinear'
import type { MarketplaceIntegrationId } from './marketplace-integrations'

/** The page for a Settings integration: the same Banner, Connection, Advanced options and Danger zone as an app page. */
export function MarketplaceIntegrationPage({
  integration,
  onBack
}: {
  integration: MarketplaceIntegrationId
  onBack: () => void
}): React.JSX.Element {
  useIntegrationProviderStatusRefresh()
  return (
    <div className={cn(SKILLS_PAGE_COLUMN, 'flex flex-col gap-6 py-4')}>
      <div>
        {/* Why: connections are app-wide, so unlike the host-bound app pages there is no host picker here. */}
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
          {translate('auto.components.marketplace.MarketplaceAppPage.back', 'Back')}
        </Button>
      </div>
      <IntegrationBody integration={integration} />
    </div>
  )
}

function IntegrationBody({
  integration
}: {
  integration: MarketplaceIntegrationId
}): React.JSX.Element {
  switch (integration) {
    case 'gitlab':
      return <MarketplaceGitLabIntegration />
    case 'bitbucket':
      return <MarketplaceBitbucketIntegration />
    case 'azure-devops':
    case 'gitea':
      return <MarketplaceTokenIntegration provider={integration} />
    case 'linear':
      return <MarketplaceLinearIntegration />
    case 'jira':
      return <MarketplaceJiraIntegration />
  }
}
