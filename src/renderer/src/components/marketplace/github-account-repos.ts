import type { GhAuthAccount } from '../../../../shared/github/auth-types'
import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import type { Repo } from '../../../../shared/repo-types'

export type GitHubAccountRow = {
  account: GhAuthAccount
  repoNames: string[]
}

export type GitHubAccountRepoGroups = {
  rows: GitHubAccountRow[]
  /** No binding: these repos use whichever account is active. */
  unboundRepoNames: string[]
  /** Bound to a login that is not signed in on this computer. */
  missingAccountRepos: { repoName: string; binding: GhAccountBinding }[]
}

function sameLogin(account: GhAuthAccount, binding: GhAccountBinding): boolean {
  return (
    account.host.toLowerCase() === binding.host.toLowerCase() &&
    account.user.toLowerCase() === binding.user.toLowerCase()
  )
}

export function groupReposByGitHubAccount(
  accounts: readonly GhAuthAccount[],
  repos: readonly Pick<Repo, 'displayName' | 'ghAccount'>[]
): GitHubAccountRepoGroups {
  const groups: GitHubAccountRepoGroups = {
    rows: accounts.map((account) => ({ account, repoNames: [] })),
    unboundRepoNames: [],
    missingAccountRepos: []
  }
  for (const repo of repos) {
    const binding = repo.ghAccount
    if (!binding) {
      groups.unboundRepoNames.push(repo.displayName)
      continue
    }
    const row = groups.rows.find((candidate) => sameLogin(candidate.account, binding))
    if (row) {
      row.repoNames.push(repo.displayName)
    } else {
      groups.missingAccountRepos.push({ repoName: repo.displayName, binding })
    }
  }
  return groups
}
