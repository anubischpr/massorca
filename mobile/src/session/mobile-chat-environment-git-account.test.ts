import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import { readRepoGitAccount } from '../worktree/repo-git-account-read'
import { withRepoGitAccount, type MobileChatEnvironment } from './mobile-chat-environment-read'

vi.mock('../worktree/repo-git-account-read', () => ({ readRepoGitAccount: vi.fn() }))

const read = vi.mocked(readRepoGitAccount)
const client = {} as RpcClient

function environmentWith(ghAccount: MobileChatEnvironment['ghAccount']): MobileChatEnvironment {
  return {
    worktree: { repoId: 'r1' } as MobileChatEnvironment['worktree'],
    ghAccount
  }
}

describe('withRepoGitAccount', () => {
  it('shows the repo gh.account login, exactly, in place of the bound one', async () => {
    read.mockResolvedValueOnce({ kind: 'bound', login: 'palominoc-perulaunch' })
    const result = await withRepoGitAccount(
      client,
      environmentWith({ host: 'github.com', user: 'palominoc' })
    )
    expect(result.ghAccount).toEqual({ host: 'github.com', user: 'palominoc-perulaunch' })
  })

  it('keeps the bound account when the repo pins no login', async () => {
    read.mockResolvedValueOnce({ kind: 'unbound' })
    const bound = { host: 'github.com', user: 'palominoc' }
    expect((await withRepoGitAccount(client, environmentWith(bound))).ghAccount).toEqual(bound)
  })

  it('keeps the bound account when the host predates the method or does not answer', async () => {
    read.mockResolvedValueOnce({ kind: 'unavailable' })
    const bound = { host: 'github.com', user: 'palominoc' }
    expect((await withRepoGitAccount(client, environmentWith(bound))).ghAccount).toEqual(bound)
    read.mockResolvedValueOnce({ kind: 'unreachable' })
    expect((await withRepoGitAccount(client, environmentWith(bound))).ghAccount).toEqual(bound)
  })

  it('names github.com as the host when the repo binds no account but pins a login', async () => {
    read.mockResolvedValueOnce({ kind: 'bound', login: 'palominoc' })
    expect((await withRepoGitAccount(client, environmentWith(null))).ghAccount).toEqual({
      host: 'github.com',
      user: 'palominoc'
    })
  })
})
