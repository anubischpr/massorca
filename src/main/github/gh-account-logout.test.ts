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

  it('logs out an inactive account with one gh call and never switches the active login', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
    expect(await removeGhAccount({ host: 'github.com', user: 'side' }, {}, exec)).toEqual({
      ok: true
    })
    // Why: gh keeps the active login when another one is logged out, so no switch is needed.
    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec.mock.calls[0]?.[0]).toEqual([
      'auth',
      'logout',
      '--hostname',
      'github.com',
      '--user',
      'side'
    ])
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
