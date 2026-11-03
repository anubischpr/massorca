import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { GitHubAccountsCard } from './GitHubAccountsCard'
import { GITHUB_CLI_URL } from './marketplace-catalog'
import type { MarketplaceBadgeState } from './marketplace-status'

export function GitHubDetail({ state }: { state: MarketplaceBadgeState }): React.JSX.Element {
  if (state === 'signed-in' || state === 'not-signed-in') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          {state === 'signed-in'
            ? translate(
                'auto.components.marketplace.GitHubDetail.signedIn',
                'The GitHub CLI is signed in on this computer.'
              )
            : translate(
                'auto.components.marketplace.GitHubDetail.signIn',
                'Sign in with {{command}} on this computer.',
                { command: 'gh auth login' }
              )}
        </p>
        <GitHubAccountsCard />
      </div>
    )
  }
  if (state === 'not-installed') {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm">
          {translate(
            'auto.components.marketplace.GitHubDetail.notInstalled',
            'The GitHub CLI (gh) is not installed on this computer.'
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void window.api.shell.openUrl(GITHUB_CLI_URL)}
        >
          {translate('auto.components.marketplace.GitHubDetail.getCli', 'Get GitHub CLI')}
        </Button>
      </div>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">
      {state === 'unknown'
        ? translate(
            'auto.components.marketplace.GitHubDetail.unknown',
            'Could not check GitHub on this computer.'
          )
        : translate(
            'auto.components.marketplace.GitHubDetail.checking',
            'Checking GitHub on this computer…'
          )}
    </p>
  )
}
