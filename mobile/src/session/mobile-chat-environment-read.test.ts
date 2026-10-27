import { describe, expect, it } from 'vitest'
import { environmentFromReplies } from './mobile-chat-environment-read'

const ROW = {
  worktreeId: 'w1',
  repoId: 'r1',
  repo: 'massorca',
  branch: 'main',
  path: '/work/massorca',
  hostId: 'local'
}

describe('environmentFromReplies', () => {
  it('joins the worktree row with the account its repo binds', () => {
    expect(
      environmentFromReplies({
        worktreeId: 'w1',
        catalogRows: [{ ...ROW, worktreeId: 'w2' }, ROW],
        repos: [{ id: 'r1', ghAccount: { host: 'github.com', user: 'octocat' } }]
      })
    ).toMatchObject({
      worktree: { repo: 'massorca', branch: 'main' },
      ghAccount: { host: 'github.com', user: 'octocat' }
    })
  })

  it('leaves the account null when the repo list is refused or the repo binds none', () => {
    expect(
      environmentFromReplies({ worktreeId: 'w1', catalogRows: [ROW], repos: null })?.ghAccount
    ).toBeNull()
    expect(
      environmentFromReplies({
        worktreeId: 'w1',
        catalogRows: [ROW],
        repos: [{ id: 'r1', ghAccount: null }]
      })?.ghAccount
    ).toBeNull()
  })

  it('answers null when the catalog does not list the worktree', () => {
    expect(environmentFromReplies({ worktreeId: 'w9', catalogRows: [ROW], repos: [] })).toBeNull()
  })
})
