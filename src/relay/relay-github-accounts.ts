import { listGhAccountBindingInventory } from '../main/github/gh-account-binding-inventory'
import { removeGhAccount } from '../main/github/gh-account-logout'
import { switchGhActiveAccount } from '../main/github/gh-account-switch'
import { normalizeGhAccountBinding } from '../shared/github/account-binding'
import type { GhAccountBindingInventory, GhAuthAccount } from '../shared/github/auth-types'
import type { RelayDispatcher } from './dispatcher'

/** The gh account methods this relay serves; a relay that predates them answers method-not-found. */
export const RELAY_GITHUB_ACCOUNT_METHODS = {
  list: 'github.listHostBindableAccounts',
  switchActiveAccount: 'github.switchActiveAccount',
  removeAccount: 'github.removeAccount'
} as const

export type RelayGitHubAccountChange =
  | { ok: true }
  | { ok: false; reason: 'invalid_account' | 'unsupported' | 'failed' }

// Why: only the fields the desktop reads leave this host, so a token a helper might carry cannot.
function toRelayAccount(account: GhAuthAccount): GhAuthAccount {
  return {
    host: account.host,
    user: account.user,
    active: account.active,
    envToken: account.envToken,
    source: account.source,
    scopes: [...account.scopes]
  }
}

/** This host's gh logins, read by the same helper the desktop uses for its own. */
export async function listRelayGitHubAccounts(): Promise<GhAccountBindingInventory> {
  const inventory = await listGhAccountBindingInventory({}, {})
  return { capability: inventory.capability, accounts: inventory.accounts.map(toRelayAccount) }
}

/** Makes one login active; the host and user pass the binding rules before any gh call. */
export async function switchRelayGitHubAccount(params: unknown): Promise<RelayGitHubAccountChange> {
  const binding = normalizeGhAccountBinding(params)
  if (!binding) {
    return { ok: false, reason: 'invalid_account' }
  }
  try {
    const result = await switchGhActiveAccount(binding, {})
    return result.ok ? { ok: true } : { ok: false, reason: result.reason }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

/** Signs one login out of gh on this host; gh's own output never leaves it. */
export async function removeRelayGitHubAccount(params: unknown): Promise<RelayGitHubAccountChange> {
  const binding = normalizeGhAccountBinding(params)
  if (!binding) {
    return { ok: false, reason: 'invalid_account' }
  }
  try {
    const result = await removeGhAccount(binding, {})
    return result.ok ? { ok: true } : { ok: false, reason: result.reason }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

/** Serves the three gh account methods on this host's relay, beside its marketplace handlers. */
export class GitHubAccountsHandler {
  constructor(dispatcher: RelayDispatcher) {
    dispatcher.onRequest(RELAY_GITHUB_ACCOUNT_METHODS.list, async () => listRelayGitHubAccounts())
    dispatcher.onRequest(RELAY_GITHUB_ACCOUNT_METHODS.switchActiveAccount, async (params) =>
      switchRelayGitHubAccount(params)
    )
    dispatcher.onRequest(RELAY_GITHUB_ACCOUNT_METHODS.removeAccount, async (params) =>
      removeRelayGitHubAccount(params)
    )
  }
}
