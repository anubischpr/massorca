import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getSecretStore } from '../../shared/secret-store'
import { writeSecureFile } from '../../shared/secure-file'
import type { SecretAtRestProtection } from '../../shared/secret-at-rest-protection'
import type { JevDecisionsStatus } from '../../shared/jev-decisions-status'

const JEV_API_KEY_FILE = 'jev-api-key.enc'
// Why a marker: base64 ciphertext never contains ':', so the bytes say how the key was stored.
const PLAINTEXT_PREFIX = 'plaintext:'
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

/** How the stored key sits on disk, or null when none is stored. Never decrypts. */
function jevApiKeyProtection(): SecretAtRestProtection | null {
  if (!hasJevApiKey()) {
    return null
  }
  try {
    return readFileSync(apiKeyPath(), 'utf8').startsWith(PLAINTEXT_PREFIX) ? 'plaintext' : 'sealed'
  } catch {
    // Why: an unreadable file is reported as apiKeyUnreadable, not as a failed status.
    return null
  }
}

/** What Settings may know about the key on this host; never its value. */
export function readJevApiKeyStatus(): JevDecisionsStatus {
  const apiKeyConfigured = hasJevApiKey()
  return {
    apiKeyConfigured,
    apiKeyUnreadable: apiKeyConfigured && !isJevApiKeyReadable(),
    apiKeyProtection: jevApiKeyProtection()
  }
}

function tryWriteRestricted(contents: string): boolean {
  try {
    return writeSecureFile(apiKeyPath(), contents)
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
  // Why: a headless host has no keyring, and the decision runs there; the owner-only file and the
  // Settings notice are how other credentials handle that host.
  const contents = getSecretStore().isEncryptionAvailable()
    ? getSecretStore().encryptString(trimmed).toString('base64')
    : `${PLAINTEXT_PREFIX}${trimmed}`
  // Why captured first: writeSecureFile has replaced the file by the time it reports a failure.
  const previous = hasJevApiKey() ? readFileSync(apiKeyPath(), 'utf8') : null
  if (!tryWriteRestricted(contents)) {
    if (previous === null) {
      rmSync(apiKeyPath(), { force: true })
    } else {
      tryWriteRestricted(previous)
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
  const contents = readFileSync(apiKeyPath(), 'utf8')
  cachedApiKey = contents.startsWith(PLAINTEXT_PREFIX)
    ? contents.slice(PLAINTEXT_PREFIX.length)
    : getSecretStore().decryptString(Buffer.from(contents, 'base64'))
  return cachedApiKey
}

export function clearJevApiKey(): void {
  cachedApiKey = null
  rmSync(apiKeyPath(), { force: true })
}
