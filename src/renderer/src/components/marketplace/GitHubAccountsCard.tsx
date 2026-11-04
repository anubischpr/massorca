import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { GhAccountBindingInventory, GhAuthAccount } from '../../../../shared/github/auth-types'
import { groupReposByGitHubAccount } from './github-account-repos'
import { gitHubAccountKey, type GitHubAccounts } from './use-github-accounts'

/** This computer's GitHub logins, the active one, and the projects each login serves. */
export function GitHubAccountsCard({ accounts }: { accounts: GitHubAccounts }): React.JSX.Element {
  const { inventory, pendingKey, switchError } = accounts
  return (
    <div className="flex flex-col gap-3">
      {inventory.kind === 'loading' ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.GitHubAccountsCard.loading',
            'Checking accounts…'
          )}
        </p>
      ) : null}
      {inventory.kind === 'failed' ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.GitHubAccountsCard.failed',
            'Could not read the GitHub accounts on this computer.'
          )}
        </p>
      ) : null}
      {inventory.kind === 'loaded' ? (
        <AccountList
          inventory={inventory.value}
          repos={accounts.localRepos}
          pendingKey={pendingKey}
          onMakeActive={accounts.makeActive}
        />
      ) : null}
      {switchError ? <p className="text-sm text-destructive">{switchError}</p> : null}
    </div>
  )
}

function AccountList({
  inventory,
  repos,
  pendingKey,
  onMakeActive
}: {
  inventory: GhAccountBindingInventory
  repos: GitHubAccounts['localRepos']
  pendingKey: string | null
  onMakeActive: (account: GhAuthAccount) => Promise<void>
}): React.JSX.Element {
  const groups = groupReposByGitHubAccount(inventory.accounts, repos)
  if (inventory.accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate(
          'auto.components.marketplace.GitHubAccountsCard.none',
          'No GitHub account is signed in on this computer.'
        )}
      </p>
    )
  }
  const canSwitch = inventory.capability !== 'unsupported'
  return (
    <div className="flex flex-col gap-3">
      {inventory.capability === 'unsupported' ? (
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.GitHubAccountsCard.multiUnsupported',
            'This GitHub CLI is too old for several accounts. Update it to 2.40 or newer.'
          )}
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {groups.rows.map(({ account, repoNames }) => (
          <li key={gitHubAccountKey(account)} className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{account.user}</span>
                {account.host === 'github.com' ? null : (
                  <span className="text-xs text-muted-foreground">{account.host}</span>
                )}
                {account.active ? (
                  <Badge variant="secondary">
                    {translate('auto.components.marketplace.GitHubAccountsCard.active', 'Active')}
                  </Badge>
                ) : null}
              </div>
              {account.source === 'env' ? (
                <span className="text-xs text-muted-foreground">
                  {translate(
                    'auto.components.marketplace.GitHubAccountsCard.envToken',
                    'Comes from {{variable}}, so it cannot be switched here.',
                    { variable: account.envToken ?? 'GITHUB_TOKEN' }
                  )}
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {repoNames.length > 0
                  ? translate(
                      'auto.components.marketplace.GitHubAccountsCard.usedBy',
                      'Projects: {{names}}',
                      { names: repoNames.join(', ') }
                    )
                  : translate(
                      'auto.components.marketplace.GitHubAccountsCard.noProjects',
                      'No project is set to this account.'
                    )}
              </span>
            </div>
            {!account.active && account.source === 'keyring' && canSwitch ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pendingKey !== null}
                onClick={() => void onMakeActive(account)}
              >
                {translate(
                  'auto.components.marketplace.GitHubAccountsCard.makeActive',
                  'Make active'
                )}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {groups.unboundRepoNames.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.marketplace.GitHubAccountsCard.unbound',
            'These projects use the active account: {{names}}',
            { names: groups.unboundRepoNames.join(', ') }
          )}
        </p>
      ) : null}
      {groups.missingAccountRepos.map(({ repoName, binding }) => (
        <p key={repoName} className="text-xs text-destructive">
          {translate(
            'auto.components.marketplace.GitHubAccountsCard.missing',
            '{{repo}} is set to {{user}} on {{host}}, which is not signed in here.',
            { repo: repoName, user: binding.user, host: binding.host }
          )}
        </p>
      ))}
    </div>
  )
}
