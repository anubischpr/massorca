import { useCallback, useEffect, useState } from 'react'
import { translate } from '@/i18n/i18n'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import type { GhAuthAccount } from '../../../../shared/github/auth-types'
import { hasRuntimeRpcErrorCode } from '../../../../shared/runtime-rpc-error-code'
import {
  readGitHubAccountChangeAnswer,
  readGitHubAccountInventoryAnswer,
  type GitHubAccountsHostChange,
  type GitHubAccountsHostList
} from '../../../../shared/rpc-contract/github-account-binding-params'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import { gitHubAccountKey, type GitHubAccounts, type GitHubInventory } from './use-github-accounts'

const RPC_TIMEOUT_MS = 30_000
const NO_REPOS: GitHubAccounts['localRepos'] = []
const NO_ORGS: GitHubAccounts['orgsByKey'] = {}

type Login = { host: string; user: string }
type ChangeAction = 'switch' | 'remove'
type ChangeFailure = Extract<GitHubAccountsHostChange, { ok: false }>

function predatesGitHubAccounts(error: unknown): boolean {
  return hasRuntimeRpcErrorCode(error, 'method_not_found')
}

/** Lists the gh logins on a picked host, read through that host's own transport. */
export async function listGitHubAccountsOnHost(
  target: MarketplaceVaultHostTarget
): Promise<GitHubAccountsHostList> {
  try {
    if (target.kind === 'wsl') {
      const inventory = await window.api.gh.listHostBindableAccounts({ wslDistro: target.distro })
      const rebuilt = readGitHubAccountInventoryAnswer(inventory)
      return rebuilt ? { ok: true, inventory: rebuilt } : { ok: false, reason: 'failed' }
    }
    if (target.kind === 'ssh') {
      const remote = window.api?.githubAccountsOnHost
      return remote
        ? await remote.listHostBindableAccounts({ connectionId: target.connectionId })
        : { ok: false, reason: 'host-needs-update' }
    }
    const answer: unknown = await callRuntimeRpc<unknown>(
      { kind: 'environment', environmentId: target.environmentId },
      'github.listHostBindableAccounts',
      {},
      { timeoutMs: RPC_TIMEOUT_MS }
    )
    const inventory = readGitHubAccountInventoryAnswer(answer)
    return inventory ? { ok: true, inventory } : { ok: false, reason: 'failed' }
  } catch (error) {
    return { ok: false, reason: predatesGitHubAccounts(error) ? 'host-needs-update' : 'failed' }
  }
}

/** Switches the active gh login on a picked host, through that host's own transport. */
export function switchGitHubAccountOnHost(
  target: MarketplaceVaultHostTarget,
  login: Login
): Promise<GitHubAccountsHostChange> {
  return changeGitHubAccountOnHost(target, login, 'switch')
}

/** Removes one gh login on a picked host, through that host's own transport. */
export function removeGitHubAccountOnHost(
  target: MarketplaceVaultHostTarget,
  login: Login
): Promise<GitHubAccountsHostChange> {
  return changeGitHubAccountOnHost(target, login, 'remove')
}

async function changeGitHubAccountOnHost(
  target: MarketplaceVaultHostTarget,
  login: Login,
  action: ChangeAction
): Promise<GitHubAccountsHostChange> {
  try {
    if (target.kind === 'wsl') {
      const args = { ...login, wslDistro: target.distro }
      const result: unknown =
        action === 'switch'
          ? await window.api.gh.switchActiveAccount(args)
          : await window.api.gh.removeAccount(args)
      return readGitHubAccountChangeAnswer(result)
    }
    if (target.kind === 'ssh') {
      const remote = window.api?.githubAccountsOnHost
      if (!remote) {
        return { ok: false, reason: 'host-needs-update' }
      }
      const args = { connectionId: target.connectionId, ...login }
      return action === 'switch' ? remote.switchActiveAccount(args) : remote.removeAccount(args)
    }
    const answer: unknown = await callRuntimeRpc<unknown>(
      { kind: 'environment', environmentId: target.environmentId },
      action === 'switch' ? 'github.switchActiveAccount' : 'github.removeAccount',
      login,
      { timeoutMs: RPC_TIMEOUT_MS }
    )
    return readGitHubAccountChangeAnswer(answer)
  } catch (error) {
    return { ok: false, reason: predatesGitHubAccounts(error) ? 'host-needs-update' : 'failed' }
  }
}

function failureMessage(
  failure: ChangeFailure,
  target: MarketplaceVaultHostTarget,
  account: GhAuthAccount,
  action: ChangeAction
): string {
  if (failure.reason === 'host-needs-update') {
    return translate(
      'auto.components.marketplace.GitHubRemoteConnection.updateRequired',
      'Update MassOrca on {{host}} first.',
      { host: target.label }
    )
  }
  if (failure.reason === 'unreachable') {
    return translate(
      'auto.components.marketplace.use-marketplace-github-host-accounts.unreachable',
      'Could not reach {{host}}.',
      { host: target.label }
    )
  }
  if (failure.reason === 'unsupported') {
    return action === 'switch'
      ? translate(
          'auto.components.marketplace.GitHubAccountsCard.switchUnsupported',
          'Update the GitHub CLI to switch accounts from here.'
        )
      : translate(
          'auto.components.marketplace.GitHubAccountsCard.removeUnsupported',
          'Update the GitHub CLI to remove accounts from here.'
        )
  }
  return action === 'switch'
    ? translate(
        'auto.components.marketplace.GitHubAccountsCard.switchFailed',
        'Could not switch to {{user}}.',
        { user: account.user }
      )
    : translate(
        'auto.components.marketplace.GitHubAccountsCard.removeFailed',
        'Could not remove {{user}}.',
        { user: account.user }
      )
}

function noop(): void {}

/**
 * The GitHub logins of a picked host (SSH, runtime or WSL), changed through that host. This
 * computer's own list stays in use-github-accounts; a picked host has no repo grouping yet.
 */
export function useMarketplaceGitHubHostAccounts(
  target: MarketplaceVaultHostTarget | null
): GitHubAccounts {
  const [inventory, setInventory] = useState<GitHubInventory>({ kind: 'loading' })
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)

  const reload = useCallback(async (): Promise<void> => {
    if (target === null) {
      return
    }
    const result = await listGitHubAccountsOnHost(target)
    setInventory(result.ok ? { kind: 'loaded', value: result.inventory } : { kind: 'failed' })
  }, [target])

  useEffect(() => {
    void reload()
  }, [reload])

  const makeActive = useCallback(
    async (account: GhAuthAccount): Promise<void> => {
      if (target === null) {
        return
      }
      setPendingKey(gitHubAccountKey(account))
      setSwitchError(null)
      const result = await switchGitHubAccountOnHost(target, {
        host: account.host,
        user: account.user
      })
      setPendingKey(null)
      if (!result.ok) {
        setSwitchError(failureMessage(result, target, account, 'switch'))
      }
      await reload()
    },
    [reload, target]
  )

  const removeAccount = useCallback(
    async (account: GhAuthAccount): Promise<string | null> => {
      if (target === null) {
        return null
      }
      const result = await removeGitHubAccountOnHost(target, {
        host: account.host,
        user: account.user
      })
      await reload()
      return result.ok ? null : failureMessage(result, target, account, 'remove')
    },
    [reload, target]
  )

  return {
    inventory,
    localRepos: NO_REPOS,
    orgsByKey: NO_ORGS,
    pendingKey,
    switchError,
    reload,
    makeActive,
    removeAccount,
    signInOpen: false,
    openSignIn: noop,
    closeSignIn: noop
  }
}
