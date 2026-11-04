import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { MarketplaceCredentialStore } from '../../shared/marketplace-apps'
import type { SecretStore } from '../../shared/secret-store'
import { VAULT_KEY_BYTES } from './marketplace-vault-crypto'

/** The OS keychain on the desktop (Electron safeStorage); plain Node hosts pass none. */
export type KeychainSealer = Pick<
  SecretStore,
  'isEncryptionAvailable' | 'encryptString' | 'decryptString' | 'describeProtectionGap'
>

export type MasterKey = { key: Buffer; store: MarketplaceCredentialStore }

const KEY_FILE = 'marketplace.key'
const WRAPPED_KEY_FILE = 'marketplace.key.sealed'

function keychainUsable(sealer: KeychainSealer | null): sealer is KeychainSealer {
  try {
    // Why: a keychain that seals with a weak backend would protect nothing the key file does not.
    return (
      sealer !== null && sealer.isEncryptionAvailable() && sealer.describeProtectionGap() === null
    )
  } catch {
    return false
  }
}

/** Creates the file only when absent, so two processes on one host end with the same key. */
function createExclusive(path: string, data: Buffer): void {
  try {
    writeFileSync(path, data, { flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') {
      throw error
    }
    return
  }
  try {
    chmodSync(path, 0o600)
  } catch {
    // Windows has no POSIX modes; the user profile ACL is what protects the file there.
  }
}

/**
 * The master key of one host's vault. It lives in `keyDir`, never beside the ciphertext: wrapped
 * by the OS keychain when there is one, otherwise as a 0600 file of 32 random bytes.
 */
export function createMasterKeyProvider(options: {
  keyDir: string
  sealer: () => KeychainSealer | null
}): {
  resolve: () => MasterKey | null
  /** Where the key lives, or would be created, without creating it. */
  store: () => MarketplaceCredentialStore
} {
  const sealerOrNull = (): KeychainSealer | null => {
    try {
      return options.sealer()
    } catch {
      return null
    }
  }
  const wrappedPath = join(options.keyDir, WRAPPED_KEY_FILE)
  const filePath = join(options.keyDir, KEY_FILE)
  let cached: MasterKey | null = null

  const readWrapped = (sealer: KeychainSealer | null): MasterKey | null => {
    try {
      if (!sealer?.isEncryptionAvailable()) {
        return null
      }
      const key = Buffer.from(sealer.decryptString(readFileSync(wrappedPath)), 'base64')
      return key.length === VAULT_KEY_BYTES ? { key, store: 'keychain' } : null
    } catch {
      return null
    }
  }

  const readFile = (): MasterKey | null => {
    try {
      const key = readFileSync(filePath)
      return key.length === VAULT_KEY_BYTES ? { key, store: 'key-file' } : null
    } catch {
      return null
    }
  }

  const generate = (sealer: KeychainSealer | null): MasterKey | null => {
    mkdirSync(options.keyDir, { recursive: true, mode: 0o700 })
    const key = randomBytes(VAULT_KEY_BYTES)
    if (keychainUsable(sealer)) {
      createExclusive(wrappedPath, sealer.encryptString(key.toString('base64')))
      return readWrapped(sealer)
    }
    createExclusive(filePath, key)
    return readFile()
  }

  return {
    resolve: () => {
      if (cached) {
        return cached
      }
      try {
        const sealer = sealerOrNull()
        // Why: an existing key is never replaced; a new one would orphan every sealed token.
        const found = existsSync(wrappedPath)
          ? readWrapped(sealer)
          : existsSync(filePath)
            ? readFile()
            : generate(sealer)
        cached = found
        return found
      } catch {
        return null
      }
    },
    store: () => {
      if (existsSync(wrappedPath)) {
        return 'keychain'
      }
      if (existsSync(filePath)) {
        return 'key-file'
      }
      return keychainUsable(sealerOrNull()) ? 'keychain' : 'key-file'
    }
  }
}
