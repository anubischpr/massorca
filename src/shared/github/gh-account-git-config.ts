/**
 * Repo-local git config that pins a project to a GitHub account, mirroring the
 * hand-written convention: `gh.account`, a reset + `gh auth token --user` credential
 * helper, the credential username, and an opt-in noreply commit identity.
 *
 * Why shared: main builds the writes and the SSH relay re-validates the exact same
 * shapes, so the allowlist cannot drift from what main emits.
 */
import type { GhAccountBinding } from './account-binding'

export const GH_ACCOUNT_GIT_CONFIG_KEY = 'gh.account'

export type GhAccountGitIdentity = { name: string; email: string }

export type GhAccountGitConfigRequest = {
  next: GhAccountBinding | null
  previous: GhAccountBinding | null
  identity: GhAccountGitIdentity | null
}

export type GhAccountGitConfigState = {
  account: string | null
  /** True when user.name/email are exactly the noreply identity Orca writes for `account`. */
  identityManaged: boolean
}

export type GhAccountGitConfigError =
  | 'folder_workspace'
  | 'unsafe_login'
  | 'ssh_unavailable'
  | 'git_failed'

export type GhAccountGitConfigResult =
  | { ok: true; identity: 'set' | 'not_requested' | 'unavailable' }
  | { ok: false; error: GhAccountGitConfigError; message?: string }

// Why: the login is interpolated into a shell helper, so allow only GitHub's login charset.
const SAFE_LOGIN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/
const SAFE_HOST_RE = /^[a-z0-9][a-z0-9.-]*(?::\d+)?$/
const HELPER_KEY_RE = /^credential\.https:\/\/([^\s]+)\.helper$/
const USERNAME_KEY_RE = /^credential\.https:\/\/([^\s]+)\.username$/
const HELPER_LOGIN_RE = /^!f\(\) \{ test "\$1" = get \|\| exit 0; echo username=(\S+);/

export function isGitConfigSafeGhLogin(user: string): boolean {
  return SAFE_LOGIN_RE.test(user)
}

export function isGitConfigSafeGhBinding(binding: GhAccountBinding): boolean {
  return SAFE_LOGIN_RE.test(binding.user) && SAFE_HOST_RE.test(binding.host)
}

export function ghCredentialHelperKey(host: string): string {
  return `credential.https://${host}.helper`
}

export function ghCredentialUsernameKey(host: string): string {
  return `credential.https://${host}.username`
}

export function ghCredentialHelperCommand(binding: GhAccountBinding): string {
  // Why: github.com omits --hostname so it matches helpers users already wrote by hand.
  const hostArg = binding.host === 'github.com' ? '' : ` --hostname ${binding.host}`
  return `!f() { test "$1" = get || exit 0; echo username=${binding.user}; echo "password=$(gh auth token${hostArg} --user ${binding.user})"; }; f`
}

export function ghNoreplyEmail(binding: GhAccountBinding, accountId: number): string {
  return `${accountId}+${binding.user}@users.noreply.${binding.host}`
}

export function isGhNoreplyEmailFor(binding: GhAccountBinding, email: string): boolean {
  const suffix = `+${binding.user}@users.noreply.${binding.host}`
  return (
    email.length > suffix.length &&
    email.endsWith(suffix) &&
    /^\d+$/.test(email.slice(0, -suffix.length))
  )
}

/** Keys as `git config --list` prints them: section/name lowercased, subsection kept. */
export type GitConfigEntries = ReadonlyMap<string, readonly string[]>

function only(entries: GitConfigEntries, key: string): string | null {
  const values = entries.get(key)
  return values && values.length === 1 ? values[0] : null
}

export function readGhAccountGitConfigState(entries: GitConfigEntries): GhAccountGitConfigState {
  const account = entries.get(GH_ACCOUNT_GIT_CONFIG_KEY)?.at(-1) ?? null
  if (!account) {
    return { account: null, identityManaged: false }
  }
  const helperHost = [...entries.keys()]
    .map((key) => HELPER_KEY_RE.exec(key)?.[1])
    .find((host): host is string => Boolean(host))
  const binding = { host: helperHost ?? 'github.com', user: account }
  const email = only(entries, 'user.email')
  return {
    account,
    identityManaged:
      only(entries, 'user.name') === account &&
      email !== null &&
      isGhNoreplyEmailFor(binding, email)
  }
}

/** Removes only entries whose values still equal what Orca writes for `binding`. */
function planRemovals(entries: GitConfigEntries, binding: GhAccountBinding): string[][] {
  const writes: string[][] = []
  if (only(entries, GH_ACCOUNT_GIT_CONFIG_KEY) === binding.user) {
    writes.push(['--unset-all', GH_ACCOUNT_GIT_CONFIG_KEY])
  }
  const helperKey = ghCredentialHelperKey(binding.host)
  const helpers = entries.get(helperKey)
  if (
    helpers?.length === 2 &&
    helpers[0] === '' &&
    helpers[1] === ghCredentialHelperCommand(binding)
  ) {
    writes.push(['--unset-all', helperKey])
  }
  const usernameKey = ghCredentialUsernameKey(binding.host)
  if (only(entries, usernameKey) === binding.user) {
    writes.push(['--unset-all', usernameKey])
  }
  const email = only(entries, 'user.email')
  if (
    only(entries, 'user.name') === binding.user &&
    email !== null &&
    isGhNoreplyEmailFor(binding, email)
  ) {
    writes.push(['--unset-all', 'user.name'], ['--unset-all', 'user.email'])
  }
  return writes
}

/** Argument lists for `git config --local <...>`, in order. */
export function planGhAccountGitConfigWrites(
  entries: GitConfigEntries,
  request: GhAccountGitConfigRequest
): string[][] {
  const writes = request.previous ? planRemovals(entries, request.previous) : []
  const { next, identity } = request
  if (!next) {
    return writes
  }
  const helperKey = ghCredentialHelperKey(next.host)
  const helperAlreadyRemoved = writes.some((w) => w[0] === '--unset-all' && w[1] === helperKey)
  if (entries.has(helperKey) && !helperAlreadyRemoved) {
    writes.push(['--unset-all', helperKey])
  }
  writes.push(
    ['--replace-all', GH_ACCOUNT_GIT_CONFIG_KEY, next.user],
    // Why: the empty entry resets helpers inherited from global/system config.
    ['--add', helperKey, ''],
    ['--add', helperKey, ghCredentialHelperCommand(next)],
    ['--replace-all', ghCredentialUsernameKey(next.host), next.user]
  )
  if (identity) {
    writes.push(
      ['--replace-all', 'user.name', identity.name],
      ['--replace-all', 'user.email', identity.email]
    )
  }
  return writes
}

function hostFromKey(re: RegExp, key: string): string | null {
  const host = re.exec(key)?.[1]
  return host && SAFE_HOST_RE.test(host) ? host : null
}

function isAllowedValue(key: string, value: string): boolean {
  if (key === GH_ACCOUNT_GIT_CONFIG_KEY || key === 'user.name') {
    return isGitConfigSafeGhLogin(value)
  }
  if (key === 'user.email') {
    const match = /^\d+\+([^@]+)@users\.noreply\.(.+)$/.exec(value)
    return Boolean(match && isGitConfigSafeGhLogin(match[1]) && SAFE_HOST_RE.test(match[2]))
  }
  const usernameHost = hostFromKey(USERNAME_KEY_RE, key)
  return usernameHost !== null && isGitConfigSafeGhLogin(value)
}

function isManagedKey(key: string): boolean {
  return (
    key === GH_ACCOUNT_GIT_CONFIG_KEY ||
    key === 'user.name' ||
    key === 'user.email' ||
    hostFromKey(HELPER_KEY_RE, key) !== null ||
    hostFromKey(USERNAME_KEY_RE, key) !== null
  )
}

/**
 * True only for the exact `config --local` write shapes `planGhAccountGitConfigWrites` emits.
 * `args` excludes the leading `config`.
 */
export function isAllowedGhAccountGitConfigWrite(args: readonly string[]): boolean {
  if (args[0] !== '--local') {
    return false
  }
  const [, op, key, value] = args
  if (typeof key !== 'string' || !isManagedKey(key)) {
    return false
  }
  if (op === '--unset-all') {
    return args.length === 3
  }
  if (args.length !== 4 || typeof value !== 'string') {
    return false
  }
  const helperHost = hostFromKey(HELPER_KEY_RE, key)
  if (op === '--add') {
    if (!helperHost) {
      return false
    }
    if (value === '') {
      return true
    }
    const user = HELPER_LOGIN_RE.exec(value)?.[1]
    return Boolean(
      user &&
      isGitConfigSafeGhLogin(user) &&
      value === ghCredentialHelperCommand({ host: helperHost, user })
    )
  }
  return op === '--replace-all' && !helperHost && isAllowedValue(key, value)
}
