import { translate } from '@/i18n/i18n'
import type {
  MarketplaceCredentialLocation,
  MarketplaceVaultHostResult
} from '../../../../shared/marketplace-apps'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** "3 minutes ago" in the person's language; a moment ago for anything under a minute. */
export function relativeTimeAgo(timestamp: number, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - timestamp)
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (elapsed < MINUTE_MS) {
    return format.format(0, 'second')
  }
  if (elapsed < HOUR_MS) {
    return format.format(-Math.floor(elapsed / MINUTE_MS), 'minute')
  }
  if (elapsed < DAY_MS) {
    return format.format(-Math.floor(elapsed / HOUR_MS), 'hour')
  }
  return format.format(-Math.floor(elapsed / DAY_MS), 'day')
}

export function storedEncryptedOn(hostLabel: string): string {
  return translate(
    'auto.components.marketplace.marketplace-vault-credential-text.storedOn',
    'Stored encrypted on {{host}}',
    { host: hostLabel }
  )
}

export function updatedAgo(updatedAt: number, now?: number): string {
  return translate(
    'auto.components.marketplace.marketplace-vault-credential-text.updated',
    'Updated {{when}}',
    { when: relativeTimeAgo(updatedAt, now) }
  )
}

/** Where the credential lives and when it changed, as one line; never a value. */
export function credentialSummary(credential: {
  updatedAt?: number
  location?: MarketplaceCredentialLocation
}): string | null {
  const parts = [
    credential.location ? storedEncryptedOn(credential.location.hostLabel) : null,
    credential.updatedAt === undefined ? null : updatedAgo(credential.updatedAt)
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(' · ') : null
}

type VaultHostFailure = Extract<MarketplaceVaultHostResult, { ok: false }>['reason']

/** Why a host's vault could not be changed, in plain words; an old host is told to update first. */
export function vaultHostFailureMessage(reason: VaultHostFailure, hostLabel: string): string {
  switch (reason) {
    case 'host-needs-update':
      return translate(
        'auto.components.marketplace.marketplace-vault-credential-text.needsUpdate',
        'Update MassOrca on {{host}} first.',
        { host: hostLabel }
      )
    case 'unreachable':
      return translate(
        'auto.components.marketplace.marketplace-vault-credential-text.unreachable',
        '{{host}} is not reachable right now.',
        { host: hostLabel }
      )
    case 'invalid-input':
      return translate(
        'auto.components.marketplace.marketplace-vault-credential-text.invalid',
        'Check the token, then try again.'
      )
    case 'vault-unavailable':
      return translate(
        'auto.components.marketplace.marketplace-vault-credential-text.vaultUnavailable',
        'The vault on {{host}} could not create its key.',
        { host: hostLabel }
      )
    case 'failed':
      return translate(
        'auto.components.marketplace.marketplace-vault-credential-text.failed',
        'The change on {{host}} did not complete.',
        { host: hostLabel }
      )
  }
}
