// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ callRuntimeRpc: vi.fn() }))

vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.callRuntimeRpc }))
vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))

import {
  listGitHubAccountsOnHost,
  removeGitHubAccountOnHost,
  switchGitHubAccountOnHost
} from './use-marketplace-github-host-accounts'

const inventory = {
  capability: 'supported',
  accounts: [
    {
      host: 'github.com',
      user: 'dev-box',
      active: true,
      envToken: null,
      source: 'keyring',
      scopes: ['repo']
    }
  ]
}
const runtimeTarget = { kind: 'runtime' as const, environmentId: 'env-1', label: 'pv-vps' }
const sshTarget = { kind: 'ssh' as const, connectionId: 'ssh-1', label: 'build-box' }
const wslTarget = { kind: 'wsl' as const, distro: 'Ubuntu-24.04', label: 'WSL: Ubuntu-24.04' }
const login = { host: 'github.com', user: 'dev-box' }

describe('GitHub accounts on a picked host', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(window, {
      api: {
        gh: {
          listHostBindableAccounts: vi.fn(async () => inventory),
          switchActiveAccount: vi.fn(async () => ({ ok: true })),
          removeAccount: vi.fn(async () => ({ ok: true }))
        },
        githubAccountsOnHost: {
          listHostBindableAccounts: vi.fn(async () => ({ ok: true, inventory })),
          switchActiveAccount: vi.fn(async () => ({ ok: true })),
          removeAccount: vi.fn(async () => ({ ok: true }))
        }
      }
    })
  })

  it('reads a runtime host through its own runtime RPC', async () => {
    mocks.callRuntimeRpc.mockResolvedValue(inventory)

    expect(await listGitHubAccountsOnHost(runtimeTarget)).toEqual({ ok: true, inventory })
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'github.listHostBindableAccounts',
      {},
      expect.anything()
    )
  })

  it('reads a WSL distro through the local bridge with its distro name', async () => {
    expect(await listGitHubAccountsOnHost(wslTarget)).toEqual({ ok: true, inventory })
    expect(window.api.gh.listHostBindableAccounts).toHaveBeenCalledWith({
      wslDistro: 'Ubuntu-24.04'
    })
  })

  it('reads an SSH host through its relay', async () => {
    expect(await listGitHubAccountsOnHost(sshTarget)).toEqual({ ok: true, inventory })
    expect(window.api.githubAccountsOnHost?.listHostBindableAccounts).toHaveBeenCalledWith({
      connectionId: 'ssh-1'
    })
  })

  it('treats a runtime that predates the methods as needing an update', async () => {
    mocks.callRuntimeRpc.mockRejectedValue({ code: 'method_not_found' })

    expect(await listGitHubAccountsOnHost(runtimeTarget)).toEqual({
      ok: false,
      reason: 'host-needs-update'
    })
  })

  it('drops any field a host adds to an account, so no token can reach the card', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({
      capability: 'supported',
      accounts: [{ ...inventory.accounts[0], token: 'gho_secret' }]
    })

    const result = await listGitHubAccountsOnHost(runtimeTarget)

    expect(JSON.stringify(result)).not.toContain('gho_secret')
  })

  it('switches and removes a login on a runtime host by host and user', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ ok: true })

    expect(await switchGitHubAccountOnHost(runtimeTarget, login)).toEqual({ ok: true })
    expect(mocks.callRuntimeRpc).toHaveBeenLastCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'github.switchActiveAccount',
      login,
      expect.anything()
    )
    expect(await removeGitHubAccountOnHost(runtimeTarget, login)).toEqual({ ok: true })
    expect(mocks.callRuntimeRpc).toHaveBeenLastCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'github.removeAccount',
      login,
      expect.anything()
    )
  })

  it('passes the WSL distro with a switch or remove on that distro', async () => {
    expect(await switchGitHubAccountOnHost(wslTarget, login)).toEqual({ ok: true })
    expect(window.api.gh.switchActiveAccount).toHaveBeenCalledWith({
      ...login,
      wslDistro: 'Ubuntu-24.04'
    })
    expect(await removeGitHubAccountOnHost(wslTarget, login)).toEqual({ ok: true })
    expect(window.api.gh.removeAccount).toHaveBeenCalledWith({
      ...login,
      wslDistro: 'Ubuntu-24.04'
    })
  })
})
