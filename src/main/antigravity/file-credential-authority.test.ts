import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  readAntigravityFileIdentity,
  verifyAntigravityFileAuthority
} from './file-credential-authority'
import { createAntigravityFileCredentialBackend } from './native-credential-backend'
import { credential } from './native-account-test-fixtures'

const env = { HOME: '/synthetic', DISPLAY: ':99' }
function fixture() {
  return {
    uid: 1000,
    socketWitness: vi.fn((): string | null => '1:2'),
    inventory: vi.fn(
      async (_path: string, _env: NodeJS.ProcessEnv, _method: string) =>
        'as 2 "org.freedesktop.DBus" ":1.1"'
    )
  }
}

describe('Antigravity file credential authority', () => {
  it('returns only stable identity metadata through the existing bounded file codec', async () => {
    const home = mkdtempSync(join(tmpdir(), 'orca-agy-identity-'))
    try {
      const backend = createAntigravityFileCredentialBackend(
        join(home, '.gemini', 'antigravity-cli', 'antigravity-oauth-token')
      )
      await backend.write(credential('synthetic-account'), null)
      expect(await readAntigravityFileIdentity(home)).toEqual({
        issuer: 'https://accounts.google.com',
        subject: 'synthetic-account',
        authMethod: 'consumer'
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
  it('verifies file fallback with a present bus and conclusively absent Secret Service', async () => {
    const deps = fixture()
    expect(await verifyAntigravityFileAuthority(env, 'linux', 'generic', deps)).toBe(
      'unavailable-secret-service:/run/user/1000/bus:1:2'
    )
    expect(deps.inventory.mock.calls.map((call) => call[2])).toEqual([
      'ListNames',
      'ListActivatableNames',
      'ListNames'
    ])
    expect(deps.socketWitness).toHaveBeenCalledTimes(2)
  })

  it.each([0, 1, 2])(
    'refuses owned, activatable, or newly owned Secret Service at query %i',
    async (slot) => {
      const deps = fixture()
      deps.inventory.mockImplementation(async () => {
        return deps.inventory.mock.calls.length - 1 === slot
          ? 'as 1 "org.freedesktop.secrets"'
          : 'as 0'
      })
      await expect(verifyAntigravityFileAuthority(env, 'linux', 'generic', deps)).rejects.toThrow()
    }
  )

  it.each(['', 'as 2 "org.freedesktop.DBus"', 'unknown', 'as 0 trailing'])(
    'refuses incomplete or unknown bus inventory %s',
    async (output) => {
      const deps = fixture()
      deps.inventory.mockResolvedValue(output)
      await expect(verifyAntigravityFileAuthority(env, 'linux', 'generic', deps)).rejects.toThrow()
    }
  )

  it('refuses failed probes, locked native authority, and replaced sockets', async () => {
    const deps = fixture()
    deps.inventory.mockRejectedValue(new Error('private backend failure'))
    await expect(verifyAntigravityFileAuthority(env, 'linux', 'generic', deps)).rejects.toThrow()
    deps.inventory.mockResolvedValue('as 1 "org.freedesktop.secrets"')
    // Locked services are still native authority: do not query credentials or Unlock.
    await expect(verifyAntigravityFileAuthority(env, 'linux', 'generic', deps)).rejects.toThrow()
    deps.inventory.mockResolvedValue('as 0')
    deps.socketWitness.mockReturnValueOnce('1:2').mockReturnValueOnce('1:3')
    await expect(verifyAntigravityFileAuthority(env, 'linux', 'generic', deps)).rejects.toThrow()
  })

  it('uses the actual runtime directory and permits an absent bus without querying it', async () => {
    const deps = fixture()
    deps.socketWitness.mockReturnValue(null)
    expect(
      await verifyAntigravityFileAuthority(
        { ...env, XDG_RUNTIME_DIR: '/synthetic/runtime' },
        'linux',
        'generic',
        deps
      )
    ).toBe('no-bus:/synthetic/runtime/bus')
    expect(deps.inventory).not.toHaveBeenCalled()
  })

  it('retains direct SSH/WSL file authority and refuses unsupported selectors', async () => {
    const deps = fixture()
    expect(
      await verifyAntigravityFileAuthority(
        { ...env, SSH_CONNECTION: 'synthetic' },
        'linux',
        '',
        deps
      )
    ).toBe('direct-file')
    expect(await verifyAntigravityFileAuthority(env, 'linux', 'microsoft', deps)).toBe(
      'direct-file'
    )
    for (const input of [
      { ...env, DBUS_SESSION_BUS_ADDRESS: 'unix:path=/another/bus' },
      { ...env, XDG_RUNTIME_DIR: 'relative' },
      { ...env, XDG_RUNTIME_DIR: '/runtime,address' }
    ]) {
      await expect(
        verifyAntigravityFileAuthority(input, 'linux', 'generic', deps)
      ).rejects.toThrow()
    }
    await expect(
      verifyAntigravityFileAuthority(env, 'linux', '', { ...deps, uid: undefined })
    ).rejects.toThrow()
    await expect(verifyAntigravityFileAuthority(env, 'darwin', '', deps)).rejects.toThrow()
    await expect(verifyAntigravityFileAuthority(env, 'win32', '', deps)).rejects.toThrow()
  })
})
