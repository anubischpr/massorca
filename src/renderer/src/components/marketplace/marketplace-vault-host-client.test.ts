import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  callRuntimeRpc: vi.fn(),
  sshSet: vi.fn(),
  sshClear: vi.fn()
}))

vi.mock('@/runtime/runtime-rpc-client', () => ({ callRuntimeRpc: mocks.callRuntimeRpc }))

const { clearVaultHostToken, readVaultHost, setVaultHostToken } =
  await import('./marketplace-vault-host-client')

const TOKEN = 'tok-SECRET-123'
const PROFILE = { kind: 'openmetadata-profile', name: 'escritura' } as const
const RUNTIME = { kind: 'runtime', environmentId: 'env-1', label: 'srv2056164' } as const
const SSH = { kind: 'ssh', connectionId: 'ssh-1', label: 'build-box' } as const
const STATUS = {
  hostLabel: 'srv2056164',
  store: 'key-file',
  credentials: [
    { slot: 'openmetadata', stored: false },
    { slot: 'engram-cloud', stored: false }
  ],
  profiles: [{ name: 'escritura', stored: true }]
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(globalThis, {
    window: {
      api: { marketplaceApps: { remoteVault: { set: mocks.sshSet, clear: mocks.sshClear } } }
    }
  })
})

describe('vault host client profile slots', () => {
  it('sets a profile token on a paired host through the profile method', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ ok: true, status: STATUS })
    const result = await setVaultHostToken(RUNTIME, PROFILE, TOKEN)
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'marketplace.vault.setProfile',
      { name: 'escritura', token: TOKEN },
      expect.anything()
    )
    expect(result).toEqual({ ok: true, status: STATUS })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
  })

  it('clears a profile token on a paired host through the profile method', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ ok: true, status: STATUS })
    await clearVaultHostToken(RUNTIME, PROFILE)
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'marketplace.vault.clearProfile',
      { name: 'escritura' },
      expect.anything()
    )
  })

  it.each(['method_not_found', 'forbidden'])(
    'reads %s from an older paired host as needing an update',
    async (code) => {
      mocks.callRuntimeRpc.mockRejectedValue(Object.assign(new Error('nope'), { code }))
      expect(await setVaultHostToken(RUNTIME, PROFILE, TOKEN)).toEqual({
        ok: false,
        reason: 'host-needs-update'
      })
    }
  )

  it('sends a profile to an SSH host as a profile, not as a slot', async () => {
    mocks.sshSet.mockResolvedValue({ ok: true, status: STATUS })
    await setVaultHostToken(SSH, PROFILE, TOKEN)
    expect(mocks.sshSet).toHaveBeenCalledWith({
      connectionId: 'ssh-1',
      profile: 'escritura',
      token: TOKEN
    })
    await clearVaultHostToken(SSH, PROFILE)
    expect(mocks.sshClear).toHaveBeenCalledWith({ connectionId: 'ssh-1', profile: 'escritura' })
  })

  it('passes the relay answer through when it predates profiles', async () => {
    mocks.sshSet.mockResolvedValue({ ok: false, reason: 'host-needs-update' })
    expect(await setVaultHostToken(SSH, PROFILE, TOKEN)).toEqual({
      ok: false,
      reason: 'host-needs-update'
    })
  })

  it('keeps the original slot requests exactly as an older host expects them', async () => {
    mocks.callRuntimeRpc.mockResolvedValue({ ok: true, status: STATUS })
    await setVaultHostToken(RUNTIME, 'openmetadata', TOKEN)
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'marketplace.vault.set',
      { slot: 'openmetadata', token: TOKEN },
      expect.anything()
    )
    mocks.sshSet.mockResolvedValue({ ok: true, status: STATUS })
    await setVaultHostToken(SSH, 'engram-cloud', TOKEN)
    expect(mocks.sshSet).toHaveBeenCalledWith({
      connectionId: 'ssh-1',
      slot: 'engram-cloud',
      token: TOKEN
    })
  })
})

describe('vault host client on a WSL distro', () => {
  const UBUNTU = { kind: 'wsl', distro: 'Ubuntu', label: 'WSL: Ubuntu' } as const

  it('answers failed for every vault call, and never reaches a runtime or this computer', async () => {
    expect(await readVaultHost(UBUNTU)).toEqual({ ok: false, reason: 'failed' })
    expect(await setVaultHostToken(UBUNTU, 'openmetadata', TOKEN)).toEqual({
      ok: false,
      reason: 'failed'
    })
    expect(await clearVaultHostToken(UBUNTU, PROFILE)).toEqual({ ok: false, reason: 'failed' })
    expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
    expect(mocks.sshSet).not.toHaveBeenCalled()
    expect(mocks.sshClear).not.toHaveBeenCalled()
  })
})
