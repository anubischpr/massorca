import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  switchGhActiveAccount: vi.fn(),
  removeGhAccount: vi.fn()
}))

vi.mock('../../../github/gh-account-switch', () => ({
  switchGhActiveAccount: mocks.switchGhActiveAccount
}))
vi.mock('../../../github/gh-account-logout', () => ({
  removeGhAccount: mocks.removeGhAccount
}))

import {
  GITHUB_ACCOUNT_BINDING_METHODS,
  GITHUB_REMOVE_ACCOUNT_METHOD,
  GITHUB_SWITCH_ACTIVE_ACCOUNT_METHOD
} from './github-account-binding-methods'

describe('GitHub account binding methods for a host', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers switch and remove as accounts-admin calls that need a host and user', () => {
    const names = GITHUB_ACCOUNT_BINDING_METHODS.map((method) => method.name)
    expect(names).toContain('github.switchActiveAccount')
    expect(names).toContain('github.removeAccount')
    for (const method of [GITHUB_SWITCH_ACTIVE_ACCOUNT_METHOD, GITHUB_REMOVE_ACCOUNT_METHOD]) {
      expect(method.permission).toBe('accounts-admin')
      expect(method.params.safeParse({ host: 'github.com', user: 'dev-box' }).success).toBe(true)
      expect(method.params.safeParse({ host: 'github.com' }).success).toBe(false)
    }
  })

  it('switches the named login on this host through the gh helper', async () => {
    mocks.switchGhActiveAccount.mockResolvedValue({ ok: true })

    // SAFETY: the handler reads no runtime field, so an empty context is the whole input.
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: see above.
    const context = {} as Parameters<typeof GITHUB_SWITCH_ACTIVE_ACCOUNT_METHOD.handler>[1]
    await expect(
      GITHUB_SWITCH_ACTIVE_ACCOUNT_METHOD.handler({ host: 'github.com', user: 'dev-box' }, context)
    ).resolves.toEqual({ ok: true })
    expect(mocks.switchGhActiveAccount).toHaveBeenCalledWith(
      { host: 'github.com', user: 'dev-box' },
      {}
    )
  })

  it('removes the named login on this host through the gh helper', async () => {
    mocks.removeGhAccount.mockResolvedValue({ ok: true })

    // SAFETY: the handler reads no runtime field, so an empty context is the whole input.
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: see above.
    const context = {} as Parameters<typeof GITHUB_REMOVE_ACCOUNT_METHOD.handler>[1]
    await expect(
      GITHUB_REMOVE_ACCOUNT_METHOD.handler({ host: 'github.com', user: 'dev-box' }, context)
    ).resolves.toEqual({ ok: true })
    expect(mocks.removeGhAccount).toHaveBeenCalledWith({ host: 'github.com', user: 'dev-box' }, {})
  })
})
