import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getSecretStore } from '../../shared/secret-store'
import {
  installFakeSecretStore,
  makeTempHome,
  resetFakeSecretStore
} from './marketplace-apps-test-fixtures'
import { MarketplaceVault } from './marketplace-vault'

const TOKEN = 'tok-SECRET-123'
const SLOT = { kind: 'openmetadata' } as const
const FILE = 'openmetadata-token.enc'
let home: string
let dir: string
let keyDir: string

beforeEach(() => {
  home = makeTempHome()
  dir = join(home, '.orca', 'marketplace')
  keyDir = join(home, '.orca', 'keys')
  installFakeSecretStore(false)
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
  resetFakeSecretStore()
})

describe('vault v2 sealing', () => {
  it('round-trips a token and never leaves it readable on disk', () => {
    const vault = new MarketplaceVault(dir)
    expect(vault.writeToken(SLOT, TOKEN)).toBe(true)
    expect(vault.readToken(SLOT)).toBe(TOKEN)
    const raw = readFileSync(join(dir, FILE))
    expect(raw.includes(Buffer.from(TOKEN))).toBe(false)
    expect(raw.subarray(0, 4).toString()).toBe('MVT2')
  })

  it('uses a fresh random IV for every write', () => {
    const vault = new MarketplaceVault(dir)
    vault.writeToken(SLOT, TOKEN)
    const first = readFileSync(join(dir, FILE))
    vault.writeToken(SLOT, TOKEN)
    const second = readFileSync(join(dir, FILE))
    expect(first.subarray(12, 24).equals(second.subarray(12, 24))).toBe(false)
  })

  it('refuses a tampered ciphertext, tag or header', () => {
    const vault = new MarketplaceVault(dir)
    vault.writeToken(SLOT, TOKEN)
    const original = readFileSync(join(dir, FILE))
    for (const offset of [original.length - 1, 30, 6]) {
      const tampered = Buffer.from(original)
      tampered[offset] ^= 0xff
      writeFileSync(join(dir, FILE), tampered)
      expect(new MarketplaceVault(dir).readToken(SLOT)).toBeNull()
    }
  })

  it('refuses a sealed file copied over another slot', () => {
    const vault = new MarketplaceVault(dir)
    vault.writeToken(SLOT, TOKEN)
    writeFileSync(join(dir, 'engram-cloud-token.enc'), readFileSync(join(dir, FILE)))
    expect(vault.readToken({ kind: 'engram-cloud' })).toBeNull()
  })

  it('reads nothing with a different master key', () => {
    new MarketplaceVault(dir).writeToken(SLOT, TOKEN)
    const other = new MarketplaceVault(dir, { keyDir: join(home, 'other-keys') })
    expect(other.readToken(SLOT)).toBeNull()
  })
})

describe('vault master key', () => {
  it('is a separate 0600 key file, never beside the ciphertext, when there is no keychain', () => {
    const vault = new MarketplaceVault(dir)
    vault.writeToken(SLOT, TOKEN)
    expect(readdirSync(dir)).toEqual([FILE])
    expect(readdirSync(keyDir)).toEqual(['marketplace.key'])
    expect(readFileSync(join(keyDir, 'marketplace.key'))).toHaveLength(32)
    if (process.platform !== 'win32') {
      expect(statSync(join(keyDir, 'marketplace.key')).mode & 0o777).toBe(0o600)
    }
    expect(vault.location().store).toBe('key-file')
  })

  it('is wrapped by the OS keychain when there is one', () => {
    installFakeSecretStore(true)
    const vault = new MarketplaceVault(dir)
    vault.writeToken(SLOT, TOKEN)
    expect(readdirSync(keyDir)).toEqual(['marketplace.key.sealed'])
    expect(readFileSync(join(keyDir, 'marketplace.key.sealed'), 'utf8')).toMatch(/^sealed:/)
    expect(vault.location().store).toBe('keychain')
    expect(new MarketplaceVault(dir).readToken(SLOT)).toBe(TOKEN)
  })

  it('does not replace an existing key, so a second process reads the first one', () => {
    new MarketplaceVault(dir).writeToken(SLOT, TOKEN)
    const key = readFileSync(join(keyDir, 'marketplace.key'))
    expect(new MarketplaceVault(dir).readToken(SLOT)).toBe(TOKEN)
    expect(readFileSync(join(keyDir, 'marketplace.key')).equals(key)).toBe(true)
  })

  it('does not invent a new key when the wrapped one cannot be opened', () => {
    installFakeSecretStore(true)
    new MarketplaceVault(dir).writeToken(SLOT, TOKEN)
    installFakeSecretStore(false)
    const vault = new MarketplaceVault(dir)
    expect(vault.readToken(SLOT)).toBeNull()
    expect(vault.writeToken(SLOT, 'other')).toBe(false)
    expect(existsSync(join(keyDir, 'marketplace.key'))).toBe(false)
  })

  it('refuses a key folder inside the ciphertext folder', () => {
    expect(() => new MarketplaceVault(dir, { keyDir: join(dir, 'keys') })).toThrow()
    expect(() => new MarketplaceVault(dir, { keyDir: dir })).toThrow()
  })

  it('works with no keychain installed at all, like a plain Node host', () => {
    resetFakeSecretStore()
    const vault = new MarketplaceVault(dir)
    expect(vault.writeToken(SLOT, TOKEN)).toBe(true)
    expect(vault.readToken(SLOT)).toBe(TOKEN)
  })
})

describe('v1 migration', () => {
  it('opens a keychain-sealed v1 file once and rewrites it as v2', () => {
    installFakeSecretStore(true)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, FILE)
    writeFileSync(file, getSecretStore().encryptString(TOKEN))
    const written = new Date('2026-01-02T03:04:05Z')
    utimesSync(file, written, written)

    const vault = new MarketplaceVault(dir)
    expect(vault.readToken(SLOT)).toBe(TOKEN)
    expect(readFileSync(file).subarray(0, 4).toString()).toBe('MVT2')
    expect(vault.credentialStatus(SLOT).updatedAt).toBe(written.getTime())

    expect(new MarketplaceVault(dir).readToken(SLOT)).toBe(TOKEN)
  })

  it('leaves a v1 file alone when the keychain cannot open it', () => {
    installFakeSecretStore(false)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, FILE), 'sealed:abc')
    expect(new MarketplaceVault(dir).readToken(SLOT)).toBeNull()
    expect(readFileSync(join(dir, FILE), 'utf8')).toBe('sealed:abc')
  })
})

describe('credential status', () => {
  it('reports set, when it changed and where, never the value', () => {
    const vault = new MarketplaceVault(dir, { hostLabel: 'srv2056164' })
    expect(vault.credentialStatus(SLOT)).toEqual({ stored: false })
    const before = Date.now()
    vault.writeToken(SLOT, TOKEN)
    const status = vault.credentialStatus(SLOT)
    expect(status).toEqual({
      stored: true,
      updatedAt: expect.any(Number),
      location: { hostLabel: 'srv2056164', store: 'key-file' }
    })
    expect(status.updatedAt).toBeGreaterThanOrEqual(before)
    expect(JSON.stringify(status)).not.toContain(TOKEN)
  })

  it('knows when the vault holds nothing', () => {
    const vault = new MarketplaceVault(dir)
    expect(vault.isEmpty()).toBe(true)
    vault.writeToken(SLOT, TOKEN)
    expect(vault.isEmpty()).toBe(false)
  })
})
