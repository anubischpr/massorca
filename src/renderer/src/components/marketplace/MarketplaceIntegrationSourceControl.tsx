import { ExternalLink, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { usePreflightCardStatuses } from '../settings/source-control-preflight-card-status'
import { ConnectionRow } from './MarketplaceAppConnection'
import { MarketplaceIntegrationAccountScope } from './MarketplaceIntegrationAdvanced'
import { MarketplaceIntegrationIcon } from './MarketplaceIntegrationIcon'
import { MarketplaceIntegrationLayout } from './MarketplaceIntegrationLayout'
import { useMarketplaceIntegrationStates } from './marketplace-integration-status'
import type { MarketplaceIntegrationId } from './marketplace-integrations'

const CARD = 'auto.components.settings.cli.source.control.integration.cards'
const TOKEN_CARD = 'auto.components.settings.token.source.control.integration.cards'

function openUrl(url: string): void {
  void window.api.shell.openUrl(url)
}

function ConnectionCard({
  integration,
  name,
  sub,
  children
}: {
  integration: MarketplaceIntegrationId
  name: string
  sub: string
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      <ConnectionRow
        icon={<MarketplaceIntegrationIcon id={integration} className="size-4 text-foreground" />}
        name={name}
        sub={sub}
        action={children}
      />
    </div>
  )
}

function LearnMoreAndRecheck({
  url,
  onRefresh
}: {
  url: string | null
  onRefresh: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      {url ? (
        <Button type="button" variant="outline" size="sm" onClick={() => openUrl(url)}>
          <ExternalLink />
          {translate(`${CARD}.8cbc39f862`, 'Learn more')}
        </Button>
      ) : null}
      <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
        {translate(`${CARD}.d5b3be8ecd`, 'Re-check')}
      </Button>
    </div>
  )
}

export function MarketplaceGitLabIntegration(): React.JSX.Element {
  const state = useMarketplaceIntegrationStates().gitlab
  const { statuses, unavailable, refresh } = usePreflightCardStatuses('glab')
  const status = unavailable ? 'unavailable' : statuses.glabStatus
  const sub =
    status === 'connected'
      ? translate(
          'auto.components.marketplace.MarketplaceIntegrationSourceControl.signedIn',
          'Signed in'
        )
      : status === 'not-installed'
        ? translate(`${CARD}.statusNotInstalled`, 'Not installed')
        : status === 'not-authenticated'
          ? translate(`${CARD}.statusNotAuthenticated`, 'Not authenticated')
          : status === 'unavailable'
            ? translate(
                `${CARD}.faddeb763d`,
                'GitLab CLI status is not available in this runtime yet.'
              )
            : translate(
                'auto.components.marketplace.MarketplaceAppPage.checking',
                'Checking this computer…'
              )
  return (
    <MarketplaceIntegrationLayout
      id="gitlab"
      state={state}
      connection={
        <div className="flex flex-col gap-3">
          <ConnectionCard integration="gitlab" name="GitLab CLI (glab)" sub={sub} />
          {status === 'not-installed' ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm">
                {translate(
                  `${CARD}.b56fd5676a`,
                  'Install the GitLab CLI to enable merge requests, issues, and pipelines.'
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openUrl('https://gitlab.com/gitlab-org/cli#installation')}
              >
                <ExternalLink />
                {translate(`${CARD}.54a640af7a`, 'Install GitLab CLI')}
              </Button>
            </div>
          ) : null}
          {status === 'not-authenticated' ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm">
                {translate(
                  `${CARD}.4be0616873`,
                  'The GitLab CLI is installed but not authenticated. Run this command in a terminal:'
                )}
              </p>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs">
                <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
                glab auth login
              </div>
            </div>
          ) : null}
          <LearnMoreAndRecheck
            url={
              status === 'not-authenticated'
                ? 'https://gitlab.com/gitlab-org/cli/-/blob/main/docs/source/auth/login.md'
                : null
            }
            onRefresh={refresh}
          />
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.marketplace.MarketplaceIntegrationSourceControl.glabHelp',
              'Accounts stay in the GitLab CLI; MassOrca never holds the token. Sign out with glab auth logout.'
            )}
          </p>
        </div>
      }
      advanced={<MarketplaceIntegrationAccountScope />}
      disconnects={[]}
    />
  )
}

type TokenProvider = 'azure-devops' | 'gitea'

const TOKEN_PROVIDERS = {
  'azure-devops': {
    name: 'Azure DevOps',
    refresh: 'azureDevOps',
    tokenName: 'ORCA_AZURE_DEVOPS_TOKEN',
    learnMore:
      'https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate'
  },
  gitea: {
    name: 'Gitea',
    refresh: 'gitea',
    tokenName: 'ORCA_GITEA_TOKEN',
    learnMore: 'https://docs.gitea.com/next/development/api-usage'
  }
} as const

function tokenHelp(provider: TokenProvider, unauthenticated: boolean): string {
  if (unauthenticated) {
    return translate(
      'auto.components.marketplace.MarketplaceIntegrationSourceControl.tokenRejected',
      '{{app}} credentials are configured but could not authenticate. Check the token, API base URL, and repository permissions, then restart MassOrca if environment variables changed.',
      { app: TOKEN_PROVIDERS[provider].name }
    )
  }
  return provider === 'gitea'
    ? translate(
        'auto.components.marketplace.MarketplaceIntegrationSourceControl.giteaSetup',
        'Public repositories are detected from their git remote. Set ORCA_GITEA_TOKEN for private repositories, and ORCA_GITEA_API_BASE_URL only when MassOrca cannot derive the API URL from the remote.'
      )
    : translate(
        'auto.components.marketplace.MarketplaceIntegrationSourceControl.azureSetup',
        'Set ORCA_AZURE_DEVOPS_TOKEN or ORCA_AZURE_DEVOPS_ACCESS_TOKEN, and ORCA_AZURE_DEVOPS_API_BASE_URL only when MassOrca cannot derive the API base URL from the git remote.'
      )
}

/** Azure DevOps and Gitea read tokens from the environment, so there is nothing to disconnect in the app. */
export function MarketplaceTokenIntegration({
  provider
}: {
  provider: TokenProvider
}): React.JSX.Element {
  const meta = TOKEN_PROVIDERS[provider]
  const state = useMarketplaceIntegrationStates()[provider]
  const { statuses, unavailable, refresh } = usePreflightCardStatuses(meta.refresh)
  const status = unavailable
    ? 'unavailable'
    : provider === 'gitea'
      ? statuses.giteaStatus
      : statuses.azureDevOpsStatus
  const account =
    provider === 'gitea'
      ? (statuses.giteaAccount ?? statuses.giteaBaseUrl)
      : (statuses.azureDevOpsAccount ?? statuses.azureDevOpsBaseUrl)
  const notSet = translate(
    'auto.components.marketplace.MarketplaceIntegrationSourceControl.notSet',
    'Not set'
  )
  return (
    <MarketplaceIntegrationLayout
      id={provider}
      state={state}
      connection={
        <div className="flex flex-col gap-3">
          <ConnectionCard
            integration={provider}
            name={translate(
              'auto.components.marketplace.MarketplaceIntegrationSourceControl.apiToken',
              'API token'
            )}
            sub={
              status === 'configured'
                ? (account ?? translate(`${TOKEN_CARD}.statusConnected`, 'Connected'))
                : status === 'unavailable'
                  ? translate(`${TOKEN_CARD}.statusUnavailable`, 'Unavailable')
                  : notSet
            }
          />
          {status === 'unavailable' ? (
            <p className="text-sm">
              {translate(
                'auto.components.marketplace.MarketplaceIntegrationSourceControl.unavailable',
                '{{app}} status is not available in this runtime yet.',
                { app: meta.name }
              )}
            </p>
          ) : status !== 'configured' && status !== 'checking' ? (
            <p className="text-sm">{tokenHelp(provider, status === 'not-authenticated')}</p>
          ) : null}
          <LearnMoreAndRecheck url={meta.learnMore} onRefresh={refresh} />
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.marketplace.MarketplaceIntegrationSourceControl.envHelp',
              'The token comes from the environment MassOrca starts in, so there is nothing to disconnect here. Remove the variable and restart MassOrca to disconnect.'
            )}
          </p>
        </div>
      }
      disconnects={[]}
    />
  )
}
