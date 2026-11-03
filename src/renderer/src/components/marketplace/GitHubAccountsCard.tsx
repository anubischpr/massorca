import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { GhAccountBindingInventory, GhAuthAccount } from '../../../../shared/github/auth-types'
import { groupReposByGitHubAccount } from './github-account-repos'

const LOGIN_COMMAND = 'gh auth login'

type Inventory =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; value: GhAccountBindingInventory }

function accountKey(account: GhAuthAccount): string {
  return `${account.host}/${account.user}`
}

async function copyLoginCommand(): Promise<void> {
  try {
    await window.api.ui.writeClipboardText(LOGIN_COMMAND)
    toast.success(
      translate('auto.components.marketplace.GitHubAccountsCard.copied', 'Copied to clipboard')
    )
  } catch {
    toast.error(
      translate('auto.components.marketplace.GitHubAccountsCard.copyFailed', 'Could not copy')
    )
  }
}

/** Lists gh logins on this computer and which projects use each; tokens never reach the renderer. */
export function GitHubAccountsCard(): React.JSX.Element {
  const repos = useAppStore((s) => s.repos)
  const [inventory, setInventory] = useState<Inventory>({ kind: 'loading' })
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    try {
      setInventory({ kind: 'loaded', value: await window.api.gh.listHostBindableAccounts() })
    } catch {
      setInventory({ kind: 'failed' })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Why: SSH and runtime repos resolve their login on their own host, not on this computer.
  const localRepos = useMemo(
    () =>
      repos.filter(
        (repo) => !repo.connectionId && (!repo.executionHostId || repo.executionHostId === 'local')
      ),
    [repos]
  )

  const makeActive = async (account: GhAuthAccount): Promise<void> => {
    setPendingKey(accountKey(account))
    setSwitchError(null)
    try {
      const result = await window.api.gh.switchActiveAccount({
        host: account.host,
        user: account.user
      })
      if (!result.ok) {
        setSwitchError(
          result.reason === 'unsupported'
            ? translate(
                'auto.components.marketplace.GitHubAccountsCard.switchUnsupported',
                'Update the GitHub CLI to switch accounts from here.'
              )
            : translate(
                'auto.components.marketplace.GitHubAccountsCard.switchFailed',
                'Could not switch to {{user}}.',
                { user: account.user }
              )
        )
      }
    } catch {
      setSwitchError(
        translate(
          'auto.components.marketplace.GitHubAccountsCard.switchFailed',
          'Could not switch to {{user}}.',
          { user: account.user }
        )
      )
    }
    setPendingKey(null)
    await load()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {translate(
            'auto.components.marketplace.GitHubAccountsCard.title',
            'GitHub accounts on this computer'
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
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
              repos={localRepos}
              pendingKey={pendingKey}
              onMakeActive={makeActive}
            />
          ) : null}
          {switchError ? <p className="text-sm text-destructive">{switchError}</p> : null}
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm">
              {translate(
                'auto.components.marketplace.GitHubAccountsCard.addAccount',
                'To add another account, run this in a terminal on this computer, then refresh:'
              )}
            </p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{LOGIN_COMMAND}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyLoginCommand()}
              >
                <Copy />
                {translate('auto.components.marketplace.GitHubAccountsCard.copy', 'Copy')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
                <RotateCw />
                {translate('auto.components.marketplace.GitHubAccountsCard.refresh', 'Refresh')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AccountList({
  inventory,
  repos,
  pendingKey,
  onMakeActive
}: {
  inventory: GhAccountBindingInventory
  repos: Parameters<typeof groupReposByGitHubAccount>[1]
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
          <li key={accountKey(account)} className="flex items-start justify-between gap-3">
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
