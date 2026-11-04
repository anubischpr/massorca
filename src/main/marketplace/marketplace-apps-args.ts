import {
  MARKETPLACE_APP_IDS,
  openMetadataProfileTokenEnv,
  type MarketplaceAppId,
  type MarketplaceConnectArgs
} from '../../shared/marketplace-apps'

const MAX_URL_LENGTH = 2048
const MAX_TOKEN_LENGTH = 8192
const PROFILE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/
/** Names an agent entry already uses, so a profile can never shadow them. */
const RESERVED_PROFILE_NAMES = new Set([
  'openmetadata',
  'openmetadata-escritura',
  'engram',
  'github'
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyPrintableAscii(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 0x21 || code > 0x7e) {
      return false
    }
  }
  return true
}

/** An http(s) address with no embedded credentials, whitespace or control characters. */
export function parseServerUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const url = value.trim()
  if (url.length === 0 || url.length > MAX_URL_LENGTH || !hasOnlyPrintableAscii(url)) {
    return null
  }
  try {
    const parsed = new URL(url)
    const web = parsed.protocol === 'https:' || parsed.protocol === 'http:'
    return web && !parsed.username && !parsed.password ? url : null
  } catch {
    return null
  }
}

/** A pasted token: printable ASCII only, so it can sit in a header or an env var unchanged. */
export function parseToken(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const token = value.trim()
  return token.length > 0 && token.length <= MAX_TOKEN_LENGTH && hasOnlyPrintableAscii(token)
    ? token
    : null
}

export function parseProfileName(value: unknown): string | null {
  return typeof value === 'string' &&
    PROFILE_NAME.test(value) &&
    !RESERVED_PROFILE_NAMES.has(value.toLowerCase())
    ? value
    : null
}

export function parseAppId(value: unknown): MarketplaceAppId | null {
  return MARKETPLACE_APP_IDS.find((id) => id === value) ?? null
}

/** Two profile names that would share one env var cannot both exist. */
export function profileEnvCollides(name: string, others: readonly string[]): boolean {
  const env = openMetadataProfileTokenEnv(name)
  return others.some((other) => other !== name && openMetadataProfileTokenEnv(other) === env)
}

export function parseConnectArgs(value: unknown): MarketplaceConnectArgs | null {
  if (!isRecord(value)) {
    return null
  }
  if (value.id === 'engram' || value.id === 'github') {
    return { id: value.id }
  }
  if (value.id === 'openmetadata') {
    const url = parseServerUrl(value.url)
    const token = parseToken(value.token)
    return url && token ? { id: 'openmetadata', url, token } : null
  }
  return null
}

export function parseDisconnectArgs(value: unknown): { id: MarketplaceAppId } | null {
  const id = isRecord(value) ? parseAppId(value.id) : null
  return id ? { id } : null
}

export function parseTokenArgs(value: unknown): { token: string } | null {
  const token = isRecord(value) ? parseToken(value.token) : null
  return token ? { token } : null
}

export function parseAddProfileArgs(
  value: unknown
): { name: string; url: string; token: string } | null {
  if (!isRecord(value)) {
    return null
  }
  const name = parseProfileName(value.name)
  const url = parseServerUrl(value.url)
  const token = parseToken(value.token)
  return name && url && token ? { name, url, token } : null
}

export function parseRemoveProfileArgs(value: unknown): { name: string } | null {
  const name = isRecord(value) ? parseProfileName(value.name) : null
  return name ? { name } : null
}

export function parseEngramServerArgs(
  value: unknown
): { url: string | null; token?: string } | null {
  if (!isRecord(value)) {
    return null
  }
  if (value.url === null) {
    return { url: null }
  }
  const url = parseServerUrl(value.url)
  if (!url) {
    return null
  }
  if (value.token === undefined) {
    return { url }
  }
  const token = parseToken(value.token)
  return token ? { url, token } : null
}
