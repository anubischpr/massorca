import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { GhAccountBindingInventory, GhAuthAccount } from '../../../../shared/github/auth-types'
import { groupReposByGitHubAccount } from './github-account-repos'
import { GitHubRemoveAccountDialog } from './GitHubRemoveAccountDialog'
import { GitHubSignInDialog } from './GitHubSignInDialog'
import { MarketplaceItemIcon } from './MarketplaceItemIcon'
import { gitHubAccountKey, type GitHubAccounts } from './use-github-accounts'

/** This computer's GitHub logins, the active one, and the projects each login serves. */
export function GitHubAccountsCard({ accounts }: { accounts: GitHubAccounts }): React.JSX.Element {
  const { inventory, pendingKey, switchError } = accounts
  // Why: removal waits for a confirmation; the row only opens the dialog for its own login.
  const [removing, setRemoving] = useState<GhAuthAccount | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <GitHubSignInDialog
        open={accounts.signInOpen}
        host="github.com"
        onOpenChange={(open) => {
          if (!open) {
            accounts.closeSignIn()
          }
        }}
        onSignedIn={() => void accounts.reload()}
      />
      {removing ? (
        <GitHubRemoveAccountDialog
          account={removing}
          onRemove={accounts.removeAccount}
          onClose={() => setRemoving(null)}
        />
      ) : null}
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
          onRemove={setRemoving}
          onSignIn={accounts.openSignIn}
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
  onMakeActive,
  onRemove,
  onSignIn
}: {
  inventory: GhAccountBindingInventory
  repos: GitHubAccounts['localRepos']
  pendingKey: string | null
  onMakeActive: (account: GhAuthAccount) => Promise<void>
  onRemove: (account: GhAuthAccount) => void
  onSignIn: () => void
}): React.JSX.Element {
  const groups = groupReposByGitHubAccount(inventory.accounts, repos)
  if (inventory.accounts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.marketplace.GitHubAccountsCard.none',
            'No GitHub account is signed in on this computer.'
          )}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onSignIn}>
          {translate('auto.components.marketplace.GitHubAccountsCard.signIn', 'Sign in to GitHub')}
        </Button>
      </div>
    )
  }
  const canManage = inventory.capability !== 'unsupported'
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
      <ul className="flex flex-col rounded-xl border border-border bg-card">
        {groups.rows.map(({ account, repoNames }) => (
          <li
            key={gitHubAccountKey(account)}
            className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
              <MarketplaceItemIcon id="github" className="size-4 text-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{account.user}</span>
                {account.host === 'github.com' ? null : (
                  <span className="text-xs text-muted-foreground">{account.host}</span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {accountDetail(account, repoNames)}
              </p>
            </div>
            {account.active ? (
              <Badge variant="secondary">
                {translate('auto.components.marketplace.GitHubAccountsCard.active', 'Active')}
              </Badge>
            ) : null}
            {account.source === 'keyring' && canManage ? (
              account.active ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendingKey !== null}
                  onClick={() => onRemove(account)}
                >
                  {translate('auto.components.marketplace.GitHubAccountsCard.remove', 'Remove')}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendingKey !== null}
                  onClick={() => void onMakeActive(account)}
                >
                  {translate(
                    'auto.components.marketplace.GitHubAccountsCard.makeActive',
                    'Make active'
                  )}
                </Button>
              )
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

/** Where one login is signed in and the projects it serves, on a single line. */
function accountDetail(account: GhAuthAccount, repoNames: readonly string[]): string {
  if (account.source === 'env') {
    return translate(
      'auto.components.marketplace.GitHubAccountsCard.envToken',
      'Comes from {{variable}}, so it cannot be switched here.',
      { variable: account.envToken ?? 'GITHUB_TOKEN' }
    )
  }
  const signedIn = translate(
    'auto.components.marketplace.GitHubAccountsCard.signedIn',
    'Signed in on this computer'
  )
  const usage =
    repoNames.length > 0
      ? translate('auto.components.marketplace.GitHubAccountsCard.usedBy', 'used by {{names}}', {
          names: repoNames.join(', ')
        })
      : translate(
          'auto.components.marketplace.GitHubAccountsCard.noProjects',
          'not used by any project'
        )
  return `${signedIn} · ${usage}`
}
