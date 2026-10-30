const MAX_CREDENTIAL_BYTES = 64 * 1024

function invalidCredential(): Error {
  return new Error('Antigravity credentials could not be decoded.')
}

function decodeUtf8(bytes: Buffer): string {
  const text = bytes.toString('utf8')
  if (!Buffer.from(text, 'utf8').equals(bytes)) {
    throw invalidCredential()
  }
  return text
}

export function decodeAntigravityKeychainValue(value: string): string {
  if (Buffer.byteLength(value) > MAX_CREDENTIAL_BYTES) {
    throw invalidCredential()
  }
  const trimmed = value.trim()
  if (trimmed.startsWith('go-keyring-base64:')) {
    const encoded = trimmed.slice('go-keyring-base64:'.length)
    const bytes = Buffer.from(encoded, 'base64')
    if (!encoded || bytes.toString('base64') !== encoded) {
      throw invalidCredential()
    }
    return decodeUtf8(bytes)
  }
  if (trimmed.startsWith('go-keyring-encoded:')) {
    const encoded = trimmed.slice('go-keyring-encoded:'.length)
    if (!/^(?:[\da-f]{2})+$/i.test(encoded)) {
      throw invalidCredential()
    }
    return decodeUtf8(Buffer.from(encoded, 'hex'))
  }
  return trimmed
}

export function encodeAntigravityKeychainValue(contents: string): string {
  if (Buffer.byteLength(contents) > MAX_CREDENTIAL_BYTES) {
    throw invalidCredential()
  }
  return `go-keyring-base64:${Buffer.from(contents, 'utf8').toString('base64')}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type AntigravityCredentialIdentity = {
  issuer: 'https://accounts.google.com'
  subject: string
  email: string | null
}

// These claims label a locally stored account; they never authorize an operation.
function readJwtIdentity(idToken: unknown): AntigravityCredentialIdentity | null {
  if (typeof idToken !== 'string') {
    return null
  }
  const parts = idToken.split('.')
  if (parts.length !== 3 || !/^[\w-]+$/.test(parts[1])) {
    return null
  }
  try {
    const claims: unknown = JSON.parse(decodeUtf8(Buffer.from(parts[1], 'base64url')))
    if (
      !isRecord(claims) ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(String(claims.iss)) ||
      typeof claims.sub !== 'string' ||
      !claims.sub.trim()
    ) {
      return null
    }
    return {
      issuer: 'https://accounts.google.com',
      subject: claims.sub,
      email:
        claims.email_verified === true && typeof claims.email === 'string' && claims.email.trim()
          ? claims.email
          : null
    }
  } catch {
    return null
  }
}

const MAX_EMAIL_LENGTH = 320

// Why: agy 1.4.10+ stores no id_token, only the signed-in address; the `email:` namespace cannot
// collide with the numeric Google subjects of the older shape.
function readEmailIdentity(value: string): AntigravityCredentialIdentity | null {
  const email = value.trim().toLowerCase()
  const at = email.indexOf('@')
  if (
    email.length > MAX_EMAIL_LENGTH ||
    at < 1 ||
    at !== email.lastIndexOf('@') ||
    at === email.length - 1 ||
    // oxlint-disable-next-line no-control-regex -- rejecting control characters is the point
    /[\s\u0000-\u001f\u007f]/.test(email)
  ) {
    return null
  }
  return { issuer: 'https://accounts.google.com', subject: `email:${email}`, email }
}

function readCredentialIdentity(
  value: Record<string, unknown>,
  token: Record<string, unknown>
): AntigravityCredentialIdentity | null {
  const idToken = value.id_token ?? token.id_token
  if (idToken !== undefined && idToken !== null) {
    return readJwtIdentity(idToken)
  }
  const label = value.id_token_email
  if (typeof label !== 'string') {
    return null
  }
  // A JWT segment alphabet has no '@', so the character decides which shape this is.
  return label.includes('@') ? readEmailIdentity(label) : readJwtIdentity(label)
}

export type AntigravityNativeCredential = {
  contents: string
  authMethod: string
  identity: AntigravityCredentialIdentity | null
}

export function parseAntigravityNativeCredential(contents: string): AntigravityNativeCredential {
  if (Buffer.byteLength(contents) > MAX_CREDENTIAL_BYTES) {
    throw invalidCredential()
  }
  let value: unknown
  try {
    value = JSON.parse(contents)
  } catch {
    throw invalidCredential()
  }
  if (
    !isRecord(value) ||
    typeof value.auth_method !== 'string' ||
    !value.auth_method.trim() ||
    !isRecord(value.token) ||
    typeof value.token.access_token !== 'string' ||
    !value.token.access_token.trim()
  ) {
    throw invalidCredential()
  }
  return {
    // Keep the exact native blob: a CLI upgrade may depend on fields Orca does not know.
    contents,
    authMethod: value.auth_method,
    identity: readCredentialIdentity(value, value.token)
  }
}
