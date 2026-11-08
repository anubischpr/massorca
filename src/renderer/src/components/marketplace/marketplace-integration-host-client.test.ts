import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  callRuntimeRpc: vi.fn(),
  status: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn()
}))

vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.callRuntimeRpc }))

const { connectServiceOnHost, disconnectServiceOnHost, readServicesOnHost } =
  await import('./marketplace-integration-host-client')

const TOKEN = 'fake-token-SECRET-123'
const RUNTIME = { kind: 'runtime', environmentId: 'env-1', label: 'srv2056164' } as const
const SSH = { kind: 'ssh', connectionId: 'ssh-1', label: 'build-box' } as const
const WSL = { kind: 'wsl', distro: 'Ubuntu', label: 'WSL: Ubuntu' } as const
const STATUS = {
  hostLabel: 'srv2056164',
  store: 'key-file',
  services: [{ service: 'gitea', source: 'stored', updatedAt: 1 }]
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(globalThis, {
    window: {
      api: {
        marketplaceServices: {
          status: mocks.status,
          connect: mocks.connect,
          disconnect: mocks.disconnect
        }
      }
    }
  })
})

describe('integration host client', () => {
  it('asks this computer over IPC and never a runtime', async () => {
    mocks.status.mockResolvedValue({ ok: true, status: STATUS })
    await readServicesOnHost(null)
    await connectServiceOnHost(null, { service: 'gitea', token: TOKEN })
    expect(mocks.status).toHaveBeenCalledTimes(1)
    expect(mocks.connect).toHaveBeenCalledWith({ service: 'gitea', token: TOKEN })
    expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
  })

  it('sends a paired host the token in the params only and never reads it back', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ ok: true, status: STATUS })
    const result = await connectServiceOnHost(RUNTIME, {
      service: 'gitea',
      token: TOKEN,
      baseUrl: 'https://git.example.com'
    })
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'marketplace.service.connect',
      { service: 'gitea', token: TOKEN, baseUrl: 'https://git.example.com' },
      expect.anything()
    )
    expect(result).toEqual({ ok: true, status: STATUS })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    expect(mocks.connect).not.toHaveBeenCalled()
  })

  it('reads a host that predates the methods as "update it first"', async () => {
    mocks.callRuntimeRpc.mockRejectedValue({ code: 'method_not_found' })
    expect(await readServicesOnHost(RUNTIME)).toEqual({ ok: false, reason: 'host-needs-update' })
    expect(await disconnectServiceOnHost(RUNTIME, { service: 'gitea' })).toEqual({
      ok: false,
      reason: 'host-needs-update'
    })
  })

  it('keeps only the reason of any other failure, never request details', async () => {
    mocks.callRuntimeRpc.mockRejectedValue(new Error(`boom ${TOKEN}`))
    const result = await connectServiceOnHost(RUNTIME, { service: 'gitea', token: TOKEN })
    expect(result).toEqual({ ok: false, reason: 'failed' })
  })

  it('has no path on SSH or WSL hosts and never answers with this computer', async () => {
    for (const target of [SSH, WSL]) {
      expect(await readServicesOnHost(target)).toEqual({ ok: false, reason: 'unavailable-on-host' })
      expect(await connectServiceOnHost(target, { service: 'gitea', token: TOKEN })).toEqual({
        ok: false,
        reason: 'unavailable-on-host'
      })
    }
    expect(mocks.status).not.toHaveBeenCalled()
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
  })
})
