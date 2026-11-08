import { useCallback, useEffect, useMemo, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { GhAccountBindingInventory, GhAuthAccount } from '../../../../shared/github/auth-types'
import type { groupReposByGitHubAccount } from './github-account-repos'

export type GitHubInventory =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; value: GhAccountBindingInventory }

type GitHubRepos = Parameters<typeof groupReposByGitHubAccount>[1]

export type GitHubAccounts = {
  inventory: GitHubInventory
  /** Repos resolved on this computer; SSH and runtime repos use their own host's login. */
  localRepos: GitHubRepos
  /** Organizations per login, keyed by `ghAccountKey`; a login with none is absent. */
  orgsByKey: Record<string, string[]>
  pendingKey: string | null
  switchError: string | null
  reload: () => Promise<void>
  makeActive: (account: GhAuthAccount) => Promise<void>
  /** Resolves to the reason to show, or null once gh has removed the login. */
  removeAccount: (account: GhAuthAccount) => Promise<string | null>
  signInOpen: boolean
  openSignIn: () => void
  closeSignIn: () => void
}

export function gitHubAccountKey(account: GhAuthAccount): string {
  return `${account.host}/${account.user}`
}

/** This computer's GitHub CLI logins; tokens never reach the renderer. */
export function useGitHubAccounts(enabled: boolean): GitHubAccounts {
  const repos = useAppStore((s) => s.repos)
  const [inventory, setInventory] = useState<GitHubInventory>({ kind: 'loading' })
  const [orgsByKey, setOrgsByKey] = useState<Record<string, string[]>>({})
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [signInOpen, setSignInOpen] = useState(false)
  const openSignIn = useCallback(() => setSignInOpen(true), [])
  const closeSignIn = useCallback(() => setSignInOpen(false), [])

  // Why: one batched lookup for every login; a failed lookup shows no organizations rather than an error.
  const loadOrgs = useCallback(async (accounts: GhAuthAccount[]): Promise<void> => {
    if (accounts.length === 0) {
      setOrgsByKey({})
      return
    }
    try {
      setOrgsByKey(
        await window.api.gh.listAccountOrgs({
          accounts: accounts.map(({ host, user }) => ({ host, user }))
        })
      )
    } catch {
      setOrgsByKey({})
    }
  }, [])

  const reload = useCallback(async (): Promise<void> => {
    try {
      const value = await window.api.gh.listHostBindableAccounts()
      setInventory({ kind: 'loaded', value })
      void loadOrgs(value.accounts)
    } catch {
      setInventory({ kind: 'failed' })
    }
  }, [loadOrgs])

  useEffect(() => {
    if (enabled) {
      void reload()
    }
  }, [enabled, reload])

  // Why: SSH and runtime repos resolve their login on their own host, not on this computer.
  const localRepos = useMemo(
    () =>
      repos.filter(
        (repo) => !repo.connectionId && (!repo.executionHostId || repo.executionHostId === 'local')
      ),
    [repos]
  )

  const makeActive = useCallback(
    async (account: GhAuthAccount): Promise<void> => {
      setPendingKey(gitHubAccountKey(account))
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
      await reload()
    },
    [reload]
  )

  const removeAccount = useCallback(
    async (account: GhAuthAccount): Promise<string | null> => {
      let failure: string | null = null
      try {
        const result = await window.api.gh.removeAccount({
          host: account.host,
          user: account.user
        })
        if (!result.ok) {
          failure =
            result.reason === 'unsupported'
              ? translate(
                  'auto.components.marketplace.GitHubAccountsCard.removeUnsupported',
                  'Update the GitHub CLI to remove accounts from here.'
                )
              : translate(
                  'auto.components.marketplace.GitHubAccountsCard.removeFailed',
                  'Could not remove {{user}}.',
                  { user: account.user }
                )
        }
      } catch {
        failure = translate(
          'auto.components.marketplace.GitHubAccountsCard.removeFailed',
          'Could not remove {{user}}.',
          { user: account.user }
        )
      }
      await reload()
      return failure
    },
    [reload]
  )

  return {
    inventory,
    localRepos,
    orgsByKey,
    pendingKey,
    switchError,
    reload,
    makeActive,
    removeAccount,
    signInOpen,
    openSignIn,
    closeSignIn
  }
}
