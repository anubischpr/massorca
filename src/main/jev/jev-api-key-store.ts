import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getSecretStore } from '../../shared/secret-store'
import { writeSecureFile } from '../../shared/secure-file'

const JEV_API_KEY_FILE = 'jev-api-key.enc'
let cachedApiKey: string | null = null

function apiKeyPath(): string {
  return join(homedir(), '.orca', JEV_API_KEY_FILE)
}

export function hasJevApiKey(): boolean {
  return existsSync(apiKeyPath())
}

/** Whether a stored key can be used on this host; a key sealed elsewhere exists but cannot. */
export function isJevApiKeyReadable(): boolean {
  try {
    return readJevApiKey() !== null
  } catch {
    return false
  }
}

export function saveJevApiKey(key: string): void {
  const trimmed = key.trim()
  if (!trimmed) {
    throw new Error('Jev API key is required')
  }
  if (/[\r\n]/.test(trimmed)) {
    throw new Error('Jev API key must be a single line')
  }
  // Why: this key is optional, so a host without a keyring goes without Jev, not with a plaintext key.
  if (!getSecretStore().isEncryptionAvailable()) {
    throw new Error('Jev API key could not be stored securely on this device')
  }
  // Why captured first: writeSecureFile has replaced the file by the time it reports a failure.
  const previous = hasJevApiKey() ? readFileSync(apiKeyPath(), 'utf8') : null
  const sealed = getSecretStore().encryptString(trimmed).toString('base64')
  if (!writeSecureFile(apiKeyPath(), sealed)) {
    if (previous === null) {
      rmSync(apiKeyPath(), { force: true })
    } else {
      writeSecureFile(apiKeyPath(), previous)
    }
    throw new Error('Jev API key could not be stored securely on this device')
  }
  cachedApiKey = trimmed
}

/** The stored key, or null when none is stored. Throws when it cannot be decrypted. */
export function readJevApiKey(): string | null {
  if (cachedApiKey !== null) {
    return cachedApiKey
  }
  if (!hasJevApiKey()) {
    return null
  }
  const sealed = Buffer.from(readFileSync(apiKeyPath(), 'utf8'), 'base64')
  cachedApiKey = getSecretStore().decryptString(sealed)
  return cachedApiKey
}

export function clearJevApiKey(): void {
  cachedApiKey = null
  rmSync(apiKeyPath(), { force: true })
}
