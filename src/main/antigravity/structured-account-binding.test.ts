import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { readAntigravityAccountBinding } from './structured-account-binding'

const home = resolve('/synthetic/host')
const identity = {
  issuer: 'https://accounts.google.com',
  subject: 'account-a',
  authMethod: 'consumer'
} as const
function fixture() {
  const env = { HOME: home, SSH_CONNECTION: 'synthetic-host-environment' }
  return {
    input: { launchEnv: env },
    deps: {
      hostEnv: env,
      hostHome: home,
      platform: 'linux' as const,
      kernelRelease: 'generic',
      readIdentity: vi.fn(
        async (): Promise<{
          issuer: typeof identity.issuer
          subject: string
          authMethod: string
        }> => identity
      ),
      readModelProvider: vi.fn((): unknown => undefined)
    }
  }
}

describe('Antigravity execution-host account binding', () => {
  it('names the Windows limitation and terminal continuation without reading credentials', async () => {
    const { input, deps } = fixture()
    await expect(
      readAntigravityAccountBinding(input, { ...deps, platform: 'win32' })
    ).rejects.toMatchObject({
      refusal: {
        code: 'structured_agent_session_unsupported',
        details: { reason: 'antigravityWindowsUnsupported' }
      }
    })
    expect(deps.readIdentity).not.toHaveBeenCalled()
  })
  it('resumes only the same authority and keeps rotating secrets out of the locator', async () => {
    const { input, deps } = fixture()
    const previous = await readAntigravityAccountBinding(input, deps)
    expect(previous).toEqual({
      kind: 'antigravity',
      locator: { home, credentialStore: 'file', ...identity }
    })
    expect(await readAntigravityAccountBinding({ ...input, previous }, deps)).toEqual(previous)
  })

  it('does not infer SSH-file authority for a systemd/Xvfb execution host', async () => {
    const { input, deps } = fixture()
    await expect(
      readAntigravityAccountBinding(input, { ...deps, hostEnv: { HOME: home, DISPLAY: ':99' } })
    ).rejects.toMatchObject({ reason: 'managedAccountUnsupported' })
    expect(deps.readIdentity).not.toHaveBeenCalled()
  })

  it.each(['win32', 'darwin'] as const)(
    'refuses unverified native %s credential storage',
    async (platform) => {
      const { deps } = fixture()
      const env = { HOME: home }
      await expect(
        readAntigravityAccountBinding({ launchEnv: env }, { ...deps, platform, hostEnv: env })
      ).rejects.toMatchObject(
        platform === 'win32'
          ? {
              refusal: {
                code: 'structured_agent_session_unsupported',
                details: { reason: 'antigravityWindowsUnsupported' }
              }
            }
          : { reason: 'managedAccountUnsupported' }
      )
      expect(deps.readIdentity).not.toHaveBeenCalled()
    }
  )

  it('rejects changed home and a child environment that no longer chooses file authority', async () => {
    const { input, deps } = fixture()
    await expect(
      readAntigravityAccountBinding(
        { launchEnv: { ...input.launchEnv, HOME: resolve('/another') } },
        deps
      )
    ).rejects.toMatchObject({ reason: 'managedAccountEnvOverride' })
    await expect(
      readAntigravityAccountBinding({ launchEnv: { HOME: home } }, deps)
    ).rejects.toMatchObject({ reason: 'managedAccountUnsupported' })
    expect(deps.readIdentity).not.toHaveBeenCalled()
  })

  it('rejects alternate provider, unknown identity and unsupported authentication methods', async () => {
    const { input, deps } = fixture()
    await expect(
      readAntigravityAccountBinding(input, { ...deps, readModelProvider: () => 'gemini' })
    ).rejects.toMatchObject({ reason: 'managedAccountUnsupported' })
    expect(deps.readIdentity).not.toHaveBeenCalled()
    for (const readIdentity of [
      async () => null,
      async () => ({ ...identity, authMethod: 'api-key' }),
      async () => ({ ...identity, subject: '' })
    ]) {
      await expect(
        readAntigravityAccountBinding(input, { ...deps, readIdentity })
      ).rejects.toMatchObject({ reason: 'managedAccountUnsupported' })
    }
  })

  it('rejects every persisted identity, backend and home drift before resuming', async () => {
    const { input, deps } = fixture()
    const original = await readAntigravityAccountBinding(input, deps)
    for (const patch of [
      { home: resolve('/another') },
      { credentialStore: 'macos-keychain' as const },
      { subject: 'account-b' },
      { authMethod: 'enterprise' }
    ]) {
      const previous = { ...original, locator: { ...original.locator, ...patch } }
      await expect(
        readAntigravityAccountBinding({ ...input, previous }, deps)
      ).rejects.toMatchObject({ reason: 'historyInOtherAccount' })
    }
  })

  it('reports native read failures without exposing their contents', async () => {
    const { input, deps } = fixture()
    await expect(
      readAntigravityAccountBinding(input, {
        ...deps,
        readIdentity: async () => {
          throw new Error('private native diagnostic')
        }
      })
    ).rejects.toMatchObject({
      reason: 'managedAccountUnsupported',
      message: 'Antigravity credential authority could not be verified.'
    })
  })

  it('binds verified systemd file fallback and rechecks host and child authority on resume', async () => {
    const { deps } = fixture()
    const launchEnv = { HOME: home, DISPLAY: ':99' }
    const verifyAuthority = vi.fn(async () => 'verified-file-fallback')
    const options = { ...deps, hostEnv: launchEnv, verifyAuthority }
    const previous = await readAntigravityAccountBinding({ launchEnv }, options)
    expect(previous.locator.credentialStore).toBe('file')
    expect(verifyAuthority).toHaveBeenCalledTimes(4)
    verifyAuthority.mockRejectedValue(new Error('native authority now available'))
    await expect(
      readAntigravityAccountBinding({ launchEnv, previous }, options)
    ).rejects.toMatchObject({
      reason: 'managedAccountUnsupported'
    })
  })

  it('refuses authority and account races during metadata acquisition', async () => {
    for (const change of ['authority', 'identity', 'provider', 'home'] as const) {
      const { input, deps } = fixture()
      const verifyAuthority = vi.fn(async () => 'file')
      if (change === 'authority') {
        verifyAuthority
          .mockResolvedValueOnce('file')
          .mockResolvedValueOnce('file')
          .mockResolvedValue('changed')
      }
      if (change === 'identity') {
        deps.readIdentity
          .mockResolvedValueOnce(identity)
          .mockResolvedValue({ ...identity, subject: 'account-b' })
      }
      if (change === 'provider') {
        deps.readModelProvider.mockReturnValueOnce(undefined).mockReturnValue('gemini')
      }
      if (change === 'home') {
        deps.readIdentity.mockImplementation(async () => {
          input.launchEnv.HOME = resolve('/changed')
          return identity
        })
      }
      await expect(
        readAntigravityAccountBinding(input, { ...deps, verifyAuthority })
      ).rejects.toMatchObject({
        reason: 'managedAccountUnsupported'
      })
    }
  })
})
