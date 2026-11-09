import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { GITHUB_CLI_URL } from './marketplace-catalog'
import { GitHubAccountsCard } from './GitHubAccountsCard'
import { MarketplaceAppSection } from './MarketplaceAppSection'
import type { CatalogCheck } from './MarketplaceCatalogRows'
import type { GitHubAccounts } from './use-github-accounts'
import type { RemoteTools } from './use-marketplace-remote-detection'

/**
 * GitHub on a picked host: the GitHub CLI state that host reports, then its logins. A host whose
 * CLI is missing or too old shows only that state; `tools` null means a WSL distro, whose logins
 * are read directly.
 */
export function GitHubRemoteConnection({
  host,
  tools,
  accounts
}: {
  host: string
  tools: CatalogCheck<RemoteTools> | null
  accounts: GitHubAccounts
}): React.JSX.Element {
  const showsAccounts = tools === null || (tools.kind === 'ready' && tools.value.gh.installed)
  return (
    <MarketplaceAppSection
      id="connection"
      title={translate('auto.components.marketplace.MarketplaceAppConnection.title', 'Connection')}
    >
      <div className="flex flex-col gap-3">
        {tools ? <GhState host={host} tools={tools} /> : null}
        {showsAccounts ? <GitHubAccountsCard accounts={accounts} hostLabel={host} /> : null}
      </div>
    </MarketplaceAppSection>
  )
}

function GhState({
  host,
  tools
}: {
  host: string
  tools: CatalogCheck<RemoteTools>
}): React.JSX.Element {
  switch (tools.kind) {
    case 'loading':
      return (
        <p className="text-sm">
          {translate(
            'auto.components.marketplace.GitHubRemoteConnection.checking',
            'Checking {{host}}…',
            { host }
          )}
        </p>
      )
    case 'update-required':
      return (
        <p className="text-sm">
          {translate(
            'auto.components.marketplace.GitHubRemoteConnection.updateRequired',
            'Update MassOrca on {{host}} first.',
            { host }
          )}
        </p>
      )
    // Why: a host with no path for the tools check reads as could not check, as a failed one does.
    case 'failed':
    case 'unavailable':
      return (
        <p className="text-sm">
          {translate(
            'auto.components.marketplace.GitHubRemoteConnection.couldNotCheck',
            'Could not check {{host}}.',
            { host }
          )}
        </p>
      )
    case 'ready':
      return <ReadyGhState host={host} gh={tools.value.gh} />
  }
}

function ReadyGhState({ host, gh }: { host: string; gh: RemoteTools['gh'] }): React.JSX.Element {
  if (!gh.installed) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm">
          {translate(
            'auto.components.marketplace.GitHubRemoteConnection.notInstalled',
            'The GitHub CLI (gh) is not installed on {{host}}.',
            { host }
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void window.api.shell.openUrl(GITHUB_CLI_URL)}
        >
          {translate(
            'auto.components.marketplace.MarketplaceAppConnection.getCli',
            'Get GitHub CLI'
          )}
        </Button>
      </div>
    )
  }
  if (!gh.authenticated) {
    return (
      <p className="text-sm">
        {translate(
          'auto.components.marketplace.GitHubRemoteConnection.signIn',
          'Sign in with gh auth login on {{host}}.',
          { host }
        )}
      </p>
    )
  }
  return (
    <p className="text-sm">
      {translate(
        'auto.components.marketplace.GitHubRemoteConnection.signedIn',
        'The GitHub CLI is signed in on {{host}}.',
        { host }
      )}
    </p>
  )
}
