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
      readIdentity: vi.fn(async () => identity),
      readModelProvider: vi.fn(() => undefined)
    }
  }
}

describe('Antigravity execution-host account binding', () => {
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
      ).rejects.toMatchObject({ reason: 'managedAccountUnsupported' })
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
})
