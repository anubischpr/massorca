import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type * as NodeOs from 'node:os'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSecretStore, type SecretStore } from '../../shared/secret-store'
import type * as SecureFile from '../../shared/secure-file'
import {
  clearJevApiKey,
  hasJevApiKey,
  isJevApiKeyReadable,
  readJevApiKey,
  saveJevApiKey
} from './jev-api-key-store'

const KEY = 'test-jev-plain-key'
const fakeHome = vi.hoisted(() => ({ path: '' }))
const secureWrite = vi.hoisted(() => ({ restricted: true }))

vi.mock('../../shared/secure-file', async (importOriginal) => {
  const actual = await importOriginal<typeof SecureFile>()
  return {
    ...actual,
    writeSecureFile: (...args: Parameters<typeof actual.writeSecureFile>) =>
      actual.writeSecureFile(...args) && secureWrite.restricted
  }
})

vi.mock('node:os', async (importOriginal) => ({
  ...(await importOriginal<typeof NodeOs>()),
  homedir: () => fakeHome.path
}))

function installSecretStore(available: boolean): void {
  const store: Partial<SecretStore> = {
    isEncryptionAvailable: () => available,
    encryptString: (text: string) => Buffer.from(`sealed:${text}`),
    decryptString: (blob: Buffer) => blob.toString('utf8').replace(/^sealed:/, '')
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the key store only calls the three methods provided above.
  setSecretStore(store as SecretStore)
}

describe('jev-api-key-store', () => {
  beforeEach(() => {
    fakeHome.path = mkdtempSync(join(tmpdir(), 'jev-key-'))
    secureWrite.restricted = true
    installSecretStore(true)
  })

  afterEach(() => {
    clearJevApiKey()
    rmSync(fakeHome.path, { recursive: true, force: true })
  })

  it('stores the key sealed, never as plaintext on disk', () => {
    saveJevApiKey(`  ${KEY}\n`)

    const onDisk = readFileSync(join(fakeHome.path, '.orca', 'jev-api-key.enc'), 'utf8')
    expect(onDisk).not.toContain(KEY)
    expect(Buffer.from(onDisk, 'base64').toString('utf8')).toBe(`sealed:${KEY}`)
    expect(hasJevApiKey()).toBe(true)
    expect(readJevApiKey()).toBe(KEY)
  })

  it('refuses to store the key on a host that cannot seal it', () => {
    installSecretStore(false)

    expect(() => saveJevApiKey(KEY)).toThrow('could not be stored securely')
    expect(existsSync(join(fakeHome.path, '.orca', 'jev-api-key.enc'))).toBe(false)
    expect(readJevApiKey()).toBeNull()
  })

  it('reports a failed secure write, leaving no file when none existed', () => {
    secureWrite.restricted = false

    expect(() => saveJevApiKey(KEY)).toThrow('could not be stored securely')

    expect(hasJevApiKey()).toBe(false)
    expect(readJevApiKey()).toBeNull()
  })

  it('keeps the previous key when a later secure write fails', () => {
    saveJevApiKey(KEY)
    secureWrite.restricted = false

    expect(() => saveJevApiKey('test-jev-other-key')).toThrow('could not be stored securely')

    expect(readJevApiKey()).toBe(KEY)
    expect(readFileSync(join(fakeHome.path, '.orca', 'jev-api-key.enc'), 'utf8')).toBe(
      Buffer.from(`sealed:${KEY}`).toString('base64')
    )
  })

  it('rejects an empty or multi-line key', () => {
    expect(() => saveJevApiKey('   ')).toThrow('required')
    expect(() => saveJevApiKey('one\ntwo')).toThrow('single line')
  })

  it('reports a stored key this host cannot decrypt as unreadable', () => {
    mkdirSync(join(fakeHome.path, '.orca'), { recursive: true })
    writeFileSync(join(fakeHome.path, '.orca', 'jev-api-key.enc'), 'c2VhbGVkLWVsc2V3aGVyZQ==')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the key store only calls this method on the read path.
    setSecretStore({
      decryptString: () => {
        throw new Error('decrypt failed')
      }
    } as unknown as SecretStore)

    expect(hasJevApiKey()).toBe(true)
    expect(isJevApiKeyReadable()).toBe(false)
  })

  it('reports a saved key as readable', () => {
    saveJevApiKey(KEY)

    expect(isJevApiKeyReadable()).toBe(true)
  })

  it('forgets the key when cleared', () => {
    saveJevApiKey(KEY)

    clearJevApiKey()

    expect(hasJevApiKey()).toBe(false)
    expect(readJevApiKey()).toBeNull()
  })
})
