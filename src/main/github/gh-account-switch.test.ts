import { describe, expect, it, vi } from 'vitest'

vi.mock('../git/runner', () => ({ ghExecFileAsync: vi.fn() }))
const invalidate = vi.hoisted(() => vi.fn())
vi.mock('./gh-account-token', () => ({ invalidateGhAccountTokenCache: invalidate }))

const { switchGhActiveAccount } = await import('./gh-account-switch')

describe('switchGhActiveAccount', () => {
  it('runs gh auth switch with the normalized host and user, then drops cached tokens', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
    const result = await switchGhActiveAccount(
      { host: ' GitHub.com ', user: 'work' },
      { wslDistro: 'Ubuntu' },
      exec
    )
    expect(result).toEqual({ ok: true })
    expect(exec).toHaveBeenCalledWith(
      ['auth', 'switch', '--hostname', 'github.com', '--user', 'work'],
      { wslDistro: 'Ubuntu' }
    )
    expect(invalidate).toHaveBeenCalledOnce()
  })

  it('refuses an invalid account without running gh', async () => {
    const exec = vi.fn()
    expect(await switchGhActiveAccount({ host: 'github.com', user: 'a b' }, {}, exec)).toEqual({
      ok: false,
      reason: 'invalid_account'
    })
    expect(await switchGhActiveAccount(null, {}, exec)).toEqual({
      ok: false,
      reason: 'invalid_account'
    })
    expect(exec).not.toHaveBeenCalled()
  })

  it('reports an old gh as unsupported and other failures without their output', async () => {
    const old = vi.fn().mockRejectedValue({ stderr: 'unknown command "switch" for "gh auth"' })
    expect(await switchGhActiveAccount({ host: 'github.com', user: 'w' }, {}, old)).toEqual({
      ok: false,
      reason: 'unsupported'
    })
    const failed = vi.fn().mockRejectedValue({ stderr: 'not logged in to github.com as w' })
    expect(await switchGhActiveAccount({ host: 'github.com', user: 'w' }, {}, failed)).toEqual({
      ok: false,
      reason: 'failed'
    })
  })
})
