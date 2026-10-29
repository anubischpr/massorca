/**
 * Guess which connected gh account a project should use from its git remote.
 *
 * Rules (user-confirmed): existing `gh.account` → SSH host alias `github.com-<login>` →
 * remote owner equals a login → owner is an org exactly one account belongs to. Anything
 * ambiguous returns null so the user picks.
 */
import type { GhAccountBinding } from './account-binding'

export type ParsedGhRemote = {
  host: string
  /** Login named by an SSH config alias such as `github.com-anubischpr`. */
  aliasLogin: string | null
  owner: string
}

export type GhAccountInferenceReason =
  | 'existing_config'
  | 'ssh_alias'
  | 'owner_login'
  | 'org_member'

export type GhAccountInference = { binding: GhAccountBinding; reason: GhAccountInferenceReason }

const SCP_RE = /^[^@/\s]+@([^:/\s]+):\/?([^/\s]+)\/[^\s]+$/
const URL_RE = /^(?:https?|ssh|git):\/\/(?:[^@/\s]+@)?([^:/\s]+)(?::\d+)?\/([^/\s]+)\/[^\s]+$/i
// Why: host-alias convention from ~/.ssh/config, e.g. `Host github.com-palominoc`.
const ALIAS_RE = /^(github\.com|[a-z0-9.-]+)-([A-Za-z0-9][A-Za-z0-9_-]*)$/

export function parseGhRemoteUrl(remoteUrl: string): ParsedGhRemote | null {
  const trimmed = remoteUrl.trim()
  const match = URL_RE.exec(trimmed) ?? SCP_RE.exec(trimmed)
  if (!match) {
    return null
  }
  const rawHost = match[1].toLowerCase()
  const owner = match[2]
  const alias = rawHost.includes('.') ? ALIAS_RE.exec(rawHost) : null
  // Why: only treat `<host>-<login>` as an alias when the prefix itself is a dotted host.
  if (alias && alias[1].includes('.')) {
    return { host: alias[1], aliasLogin: match[1].slice(alias[1].length + 1), owner }
  }
  return { host: rawHost, aliasLogin: null, owner }
}

function sameLogin(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function accountsOnHost(accounts: readonly GhAccountBinding[], host: string): GhAccountBinding[] {
  return accounts.filter((account) => account.host === host)
}

export function ghAccountKey(binding: GhAccountBinding): string {
  return `${binding.host}\0${binding.user.toLowerCase()}`
}

export type InferGhAccountInput = {
  /** Keyring accounts that can be bound. */
  accounts: readonly GhAccountBinding[]
  remoteUrl?: string | null
  existingGhAccount?: string | null
  /** Org logins per account (keyed by `ghAccountKey`); omitted until looked up. */
  orgsByAccount?: ReadonlyMap<string, readonly string[]>
}

/** Rules that need no network; `null` means an org lookup (or the user) must decide. */
export function inferGhAccountWithoutLookup(input: InferGhAccountInput): GhAccountInference | null {
  const remote = input.remoteUrl ? parseGhRemoteUrl(input.remoteUrl) : null
  const existing = input.existingGhAccount?.trim()
  if (existing) {
    const candidates = input.accounts.filter((account) => sameLogin(account.user, existing))
    const onRemoteHost = remote ? candidates.filter((a) => a.host === remote.host) : candidates
    const pick =
      onRemoteHost.length === 1 ? onRemoteHost[0] : candidates.length === 1 ? candidates[0] : null
    if (pick) {
      return { binding: pick, reason: 'existing_config' }
    }
  }
  if (!remote) {
    return null
  }
  const onHost = accountsOnHost(input.accounts, remote.host)
  if (remote.aliasLogin) {
    const alias = onHost.find((account) => sameLogin(account.user, remote.aliasLogin ?? ''))
    if (alias) {
      return { binding: alias, reason: 'ssh_alias' }
    }
  }
  const owner = onHost.find((account) => sameLogin(account.user, remote.owner))
  return owner ? { binding: owner, reason: 'owner_login' } : null
}

/** True when only an org-membership lookup could still resolve the account. */
export function ghAccountInferenceNeedsOrgLookup(input: InferGhAccountInput): boolean {
  const remote = input.remoteUrl ? parseGhRemoteUrl(input.remoteUrl) : null
  return (
    remote !== null &&
    inferGhAccountWithoutLookup(input) === null &&
    accountsOnHost(input.accounts, remote.host).length > 0
  )
}

export function inferGhAccount(input: InferGhAccountInput): GhAccountInference | null {
  const direct = inferGhAccountWithoutLookup(input)
  if (direct || !input.orgsByAccount || !input.remoteUrl) {
    return direct
  }
  const remote = parseGhRemoteUrl(input.remoteUrl)
  if (!remote) {
    return null
  }
  const members = accountsOnHost(input.accounts, remote.host).filter((account) =>
    (input.orgsByAccount?.get(ghAccountKey(account)) ?? []).some((org) =>
      sameLogin(org, remote.owner)
    )
  )
  return members.length === 1 ? { binding: members[0], reason: 'org_member' } : null
}

export type RepoGhAccountInference = {
  inference: GhAccountInference | null
  /** Owner segment of the origin remote, so the UI can say why nothing matched. */
  remoteOwner: string | null
}
