import { describe, expect, it } from 'vitest'
import type { GhAuthAccount } from '../../../../shared/github/auth-types'
import { groupReposByGitHubAccount } from './github-account-repos'

function account(user: string, host = 'github.com'): GhAuthAccount {
  return { host, user, active: false, envToken: null, source: 'keyring', scopes: [] }
}

describe('groupReposByGitHubAccount', () => {
  it('puts bound repos under their login, case-insensitively, and keeps the rest apart', () => {
    const groups = groupReposByGitHubAccount(
      [account('Work'), account('personal'), account('work', 'ghe.example.com')],
      [
        { displayName: 'a', ghAccount: { host: 'GitHub.com', user: 'work' } },
        { displayName: 'b', ghAccount: { host: 'ghe.example.com', user: 'work' } },
        { displayName: 'c' },
        { displayName: 'd', ghAccount: { host: 'github.com', user: 'gone' } }
      ]
    )
    expect(groups.rows.map((row) => row.repoNames)).toEqual([['a'], [], ['b']])
    expect(groups.unboundRepoNames).toEqual(['c'])
    expect(groups.missingAccountRepos).toEqual([
      { repoName: 'd', binding: { host: 'github.com', user: 'gone' } }
    ])
  })
})
