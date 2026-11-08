import { beforeEach, describe, expect, it, vi } from 'vitest'

const { callMock, listEnvironmentsMock, runtimeClientArgs } = vi.hoisted(() => ({
  callMock: vi.fn(),
  listEnvironmentsMock: vi.fn(() => [] as { id: string; name: string }[]),
  runtimeClientArgs: [] as unknown[][]
}))

vi.mock('../runtime-client', async () => {
  class RuntimeClient {
    readonly isRemote = false
    call = callMock
    constructor(...args: unknown[]) {
      runtimeClientArgs.push(args)
    }
    getCliStatus = vi.fn()
    openOrca = vi.fn()
  }
  // Why: the real error classes, so format.ts keeps each CLI error code.
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('../runtime/types.js')
  return {
    RuntimeClient,
    RuntimeClientError,
    RuntimeRpcFailureError,
    getDefaultUserDataPath: () => '/tmp/orca-user-data'
  }
})

vi.mock('../runtime/environments', () => ({
  addEnvironmentFromPairingCode: vi.fn(),
  listEnvironments: listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))

import { main } from '../index'
import { okFixture } from '../test-fixtures'

function answer(result: unknown) {
  callMock.mockImplementation(async (method: string) => okFixture(`req_${method}`, result))
}

function output(stream: 'log' | 'error'): string {
  return vi
    .mocked(console[stream])
    .mock.calls.map((call) => String(call[0]))
    .join('\n')
}

describe('orca marketplace github accounts', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    listEnvironmentsMock.mockReturnValue([])
    runtimeClientArgs.length = 0
    delete process.env.ORCA_PAIRING_CODE
    delete process.env.ORCA_ENVIRONMENT
    process.exitCode = undefined
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('lists accounts with the active one marked and no token', async () => {
    answer({
      capability: 'supported',
      accounts: [
        {
          host: 'github.com',
          user: 'alice',
          active: true,
          envToken: null,
          source: 'keyring',
          scopes: ['repo']
        },
        {
          host: 'github.com',
          user: 'bot',
          active: false,
          envToken: 'GH_TOKEN',
          source: 'env',
          scopes: []
        }
      ]
    })

    await main(['marketplace', 'github', 'accounts', 'list'], '/tmp/repo')

    expect(callMock.mock.calls[0].slice(0, 2)).toEqual([
      'github.listHostBindableAccounts',
      { refreshCapability: true }
    ])
    expect(output('log')).toBe(
      '* alice @ github.com (keyring; scopes: repo)\n  bot @ github.com (env GH_TOKEN)'
    )
  })

  it('runs on a paired server by connecting to it', async () => {
    listEnvironmentsMock.mockReturnValue([{ id: 'env-vps', name: 'pv-vps' }])
    answer({ ok: true })

    await main(
      ['marketplace', 'github', 'accounts', 'switch', 'alice', '--host', 'runtime:pv-vps'],
      '/tmp/repo'
    )

    expect(callMock.mock.calls[0].slice(0, 2)).toEqual([
      'github.switchActiveAccount',
      { host: 'github.com', user: 'alice' }
    ])
    expect(runtimeClientArgs.at(-1)?.[3]).toBe('env-vps')
    expect(output('log')).toContain('alice @ github.com: now the active account')
  })

  it('needs --yes to remove, and exits 1 with the reason when the host refuses', async () => {
    answer({ ok: false, reason: 'invalid_account' })

    await main(['marketplace', 'github', 'accounts', 'rm', 'bob'], '/tmp/repo')
    expect(output('error')).toContain('Re-run with --yes to confirm')
    expect(callMock).not.toHaveBeenCalled()

    await main(
      ['marketplace', 'github', 'accounts', 'rm', 'bob', '--github-host', 'ghe.acme.com', '--yes'],
      '/tmp/repo'
    )
    expect(callMock.mock.calls[0][1]).toEqual({ host: 'ghe.acme.com', user: 'bob' })
    expect(output('log')).toContain('bob @ ghe.acme.com: could not remove (invalid_account')
    expect(process.exitCode).toBe(1)
  })

  it('says WSL and SSH hosts are desktop-only, and an old host needs an update', async () => {
    await main(['marketplace', 'github', 'accounts', 'list', '--host', 'wsl:Ubuntu'], '/tmp/repo')
    expect(output('error')).toContain('only reachable from the desktop app')
    expect(callMock).not.toHaveBeenCalled()

    const { RuntimeClientError } = await import('../runtime/types.js')
    callMock.mockRejectedValue(new RuntimeClientError('method_not_found', 'nope'))
    await main(['marketplace', 'github', 'accounts', 'switch', 'alice'], '/tmp/repo')
    expect(output('error')).toContain('Update MassOrca on this host first.')
  })
})
