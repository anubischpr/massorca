import type { GhAccountBinding } from '../../../src/shared/github/account-binding'

/** One repo as the group header sees it: its name and the login it resolves to, if any. */
export type RepoGroupEntry = { displayName: string; login: string | null }

/**
 * The login each repo resolves to: its own `gh.account` when the host read one, otherwise the account
 * it binds in `repo.list`. Desktop reads in that order, so the phone does too.
 */
export function repoGroupEntries(
  catalog: readonly { id: string; displayName: string; ghAccount: GhAccountBinding | null }[],
  gitLogins: ReadonlyMap<string, string>
): RepoGroupEntry[] {
  return catalog.map((repo) => ({
    displayName: repo.displayName,
    login: gitLogins.get(repo.id) ?? repo.ghAccount?.user ?? null
  }))
}

/**
 * The login each group name shows. Groups merge by display name, so two repos with one name are one
 * group: the label is set only when every repo in that group resolves to the same exact login. A group
 * whose repos disagree, or any of whose repos has no login, shows none.
 */
export function repoAccountsByName(entries: readonly RepoGroupEntry[]): Map<string, string> {
  const byName = new Map<string, Array<string | null>>()
  for (const entry of entries) {
    byName.set(entry.displayName, [...(byName.get(entry.displayName) ?? []), entry.login])
  }
  const accounts = new Map<string, string>()
  for (const [name, logins] of byName) {
    const first = logins[0]
    if (first !== null && logins.every((login) => login === first)) {
      accounts.set(name, first)
    }
  }
  return accounts
}

/**
 * The muted login beside a repo group's name. Null outside repo grouping; null when a folder workspace
 * sits in the group (it has no repo account, so the label would claim one it lacks); null when the
 * group's repos do not agree.
 */
export function repoGroupAccountLabel(
  groupMode: string,
  title: string,
  accounts: ReadonlyMap<string, string>,
  rows: readonly { workspaceKind?: string }[]
): string | null {
  if (groupMode !== 'repo') {
    return null
  }
  if (rows.some((row) => row.workspaceKind === 'folder-workspace')) {
    return null
  }
  return accounts.get(title) ?? null
}
