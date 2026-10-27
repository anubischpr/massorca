import type { GhAccountBinding } from '../../../src/shared/github/account-binding'

/**
 * The GitHub account each repo group shows, keyed by the repo's display name. Built from the same
 * repo.list reply the groups come from, so it costs no request of its own. The login is kept exactly
 * as the host sent it: no fuzzy matching, so one account never labels another repo.
 */
export function repoAccountsByName(
  catalog: readonly { displayName: string; ghAccount: GhAccountBinding | null }[]
): Map<string, GhAccountBinding> {
  return new Map(
    catalog.flatMap((repo) => (repo.ghAccount ? [[repo.displayName, repo.ghAccount] as const] : []))
  )
}

/**
 * The muted login beside a repo group's name. Null outside repo grouping, and for a group no repo
 * account is known for, so a folder workspace (which has no repo) shows nothing.
 */
export function repoGroupAccountLabel(
  groupMode: string,
  title: string,
  accounts: ReadonlyMap<string, GhAccountBinding>
): string | null {
  if (groupMode !== 'repo') {
    return null
  }
  return accounts.get(title)?.user ?? null
}
