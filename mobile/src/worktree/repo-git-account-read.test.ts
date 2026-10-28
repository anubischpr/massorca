import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { RpcResponse } from '../transport/types'
import {
  readRepoGitAccount,
  REPO_GIT_ACCOUNT_TTL_MS,
  watchRepoGitAccounts
} from './repo-git-account-read'

const ok = (result: unknown): RpcResponse => ({ ok: true, result }) as unknown as RpcResponse
const fail = (code: string, message = ''): RpcResponse =>
  ({ ok: false, error: { code, message } }) as unknown as RpcResponse

/** A host stand-in: a fresh object per test, so unavailable marks never leak between tests. */
function hostWith(send: (repo: string) => Promise<RpcResponse>) {
  const sendRequest = vi.fn((method: string, params: { repo: string }) => {
    expect(method).toBe('github.readAccountGitConfig')
    return send(params.repo)
  })
  return { client: { sendRequest } as unknown as RpcClient, sendRequest }
}

describe('readRepoGitAccount', () => {
  it('reads the repo own gh.account login, exactly as the host sent it', async () => {
    const { client, sendRequest } = hostWith(async () =>
      ok({ account: 'palominoc-perulaunch', identityManaged: false })
    )
    await expect(readRepoGitAccount(client, 'r1')).resolves.toEqual({
      kind: 'bound',
      login: 'palominoc-perulaunch'
    })
    expect(sendRequest).toHaveBeenCalledWith(
      'github.readAccountGitConfig',
      { repo: 'id:r1' },
      expect.any(Object)
    )
  })

  it('reports an unbound repo when its git config pins no login', async () => {
    const { client } = hostWith(async () => ok(null))
    await expect(readRepoGitAccount(client, 'r1')).resolves.toEqual({ kind: 'unbound' })
    const empty = hostWith(async () => ok({ account: null, identityManaged: false }))
    await expect(readRepoGitAccount(empty.client, 'r1')).resolves.toEqual({ kind: 'unbound' })
  })

  it('asks the host once per repo within the TTL, and once more for another repo', async () => {
    const { client, sendRequest } = hostWith(async () =>
      ok({ account: 'a', identityManaged: false })
    )
    await readRepoGitAccount(client, 'r1')
    await readRepoGitAccount(client, 'r1')
    expect(sendRequest).toHaveBeenCalledTimes(1)
    await readRepoGitAccount(client, 'r2')
    expect(sendRequest).toHaveBeenCalledTimes(2)
  })

  it('asks again once the TTL has passed', async () => {
    const { client, sendRequest } = hostWith(async () =>
      ok({ account: 'a', identityManaged: false })
    )
    await readRepoGitAccount(client, 'r9', () => 0)
    await readRepoGitAccount(client, 'r9', () => REPO_GIT_ACCOUNT_TTL_MS + 1)
    expect(sendRequest).toHaveBeenCalledTimes(2)
  })

  it('remembers a host that predates the method, and never asks it again', async () => {
    const { client, sendRequest } = hostWith(async () => fail('method_not_found', 'unknown method'))
    await expect(readRepoGitAccount(client, 'r1')).resolves.toEqual({ kind: 'unavailable' })
    await expect(readRepoGitAccount(client, 'r2')).resolves.toEqual({ kind: 'unavailable' })
    expect(sendRequest).toHaveBeenCalledTimes(1)
  })

  it('treats an ordinary failure as no answer, and asks again next time', async () => {
    const { client, sendRequest } = hostWith(async () => fail('internal', 'git failed'))
    await expect(readRepoGitAccount(client, 'r1')).resolves.toEqual({ kind: 'unreachable' })
    await expect(readRepoGitAccount(client, 'r1')).resolves.toEqual({ kind: 'unreachable' })
    expect(sendRequest).toHaveBeenCalledTimes(2)
  })

  it('treats a dropped request and an unreadable reply as no answer', async () => {
    const dropped = hostWith(async () => {
      throw new Error('socket closed')
    })
    await expect(readRepoGitAccount(dropped.client, 'r1')).resolves.toEqual({ kind: 'unreachable' })
    const garbled = hostWith(async () => ok({ account: 42 }))
    await expect(readRepoGitAccount(garbled.client, 'r1')).resolves.toEqual({ kind: 'unreachable' })
  })

  it('shares one request between concurrent readers of the same repo', async () => {
    const { client, sendRequest } = hostWith(async () =>
      ok({ account: 'a', identityManaged: false })
    )
    await Promise.all([readRepoGitAccount(client, 'r1'), readRepoGitAccount(client, 'r1')])
    expect(sendRequest).toHaveBeenCalledTimes(1)
  })
})

describe('watchRepoGitAccounts', () => {
  it('reports only the bound repos, as they arrive, and nothing for the rest', async () => {
    const { client } = hostWith(async (repo) =>
      repo === 'id:r1' ? ok({ account: 'palominoc', identityManaged: false }) : ok(null)
    )
    const onBound = vi.fn()
    watchRepoGitAccounts(client, ['r1', 'r2'], onBound)
    await vi.waitFor(() => expect(onBound).toHaveBeenCalledTimes(1))
    expect(onBound).toHaveBeenCalledWith('r1', 'palominoc')
  })
})
