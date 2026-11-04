import { describe, expect, it, vi } from 'vitest'

vi.mock('../git/runner', () => ({ ghExecFileAsync: vi.fn() }))
const invalidate = vi.hoisted(() => vi.fn())
vi.mock('./gh-account-token', () => ({ invalidateGhAccountTokenCache: invalidate }))

const { removeGhAccount } = await import('./gh-account-logout')

describe('removeGhAccount', () => {
  it('runs gh auth logout with the normalized host and user, then drops cached tokens', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
    const result = await removeGhAccount(
      { host: ' GitHub.com ', user: 'work' },
      { wslDistro: 'Ubuntu' },
      exec
    )
    expect(result).toEqual({ ok: true })
    expect(exec).toHaveBeenCalledWith(
      ['auth', 'logout', '--hostname', 'github.com', '--user', 'work'],
      { wslDistro: 'Ubuntu' }
    )
    expect(invalidate).toHaveBeenCalledOnce()
  })

  it('refuses an invalid account without running gh', async () => {
    const exec = vi.fn()
    expect(await removeGhAccount({ host: 'github.com', user: 'a b' }, {}, exec)).toEqual({
      ok: false,
      reason: 'invalid_account'
    })
    expect(await removeGhAccount(null, {}, exec)).toEqual({
      ok: false,
      reason: 'invalid_account'
    })
    expect(exec).not.toHaveBeenCalled()
  })

  it('reports an old gh as unsupported and other failures without their output', async () => {
    invalidate.mockClear()
    const old = vi.fn().mockRejectedValue({ stderr: 'unknown flag: --user' })
    expect(await removeGhAccount({ host: 'github.com', user: 'w' }, {}, old)).toEqual({
      ok: false,
      reason: 'unsupported'
    })
    const failed = vi.fn().mockRejectedValue({ stderr: 'not logged in to github.com as w' })
    expect(await removeGhAccount({ host: 'github.com', user: 'w' }, {}, failed)).toEqual({
      ok: false,
      reason: 'failed'
    })
    expect(invalidate).not.toHaveBeenCalled()
  })
})
