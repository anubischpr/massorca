import {
  MARKETPLACE_REMOTE_CREDENTIAL_SLOTS,
  type MarketplaceRemoteCredentialSlot,
  type MarketplaceVaultHostResult,
  type MarketplaceVaultHostStatus
} from '../../shared/marketplace-apps'
import {
  MarketplaceVaultClear,
  MarketplaceVaultClearProfile,
  MarketplaceVaultSet,
  MarketplaceVaultSetProfile
} from '../../shared/rpc-contract/marketplace-vault-params'
import { parseProfileName, parseToken } from './marketplace-apps-args'
import type { MarketplaceVault, VaultSlot } from './marketplace-vault'

const SLOTS: Record<MarketplaceRemoteCredentialSlot, VaultSlot> = {
  openmetadata: { kind: 'openmetadata' },
  'engram-cloud': { kind: 'engram-cloud' }
}

/** What a client may see of this host's vault: set or not set and when; never a value. */
export function readVaultHostStatus(vault: MarketplaceVault): MarketplaceVaultHostStatus {
  const location = vault.location()
  return {
    hostLabel: location.hostLabel,
    store: location.store,
    credentials: MARKETPLACE_REMOTE_CREDENTIAL_SLOTS.map((slot) => {
      const { stored, updatedAt } = vault.credentialStatus(SLOTS[slot])
      return updatedAt === undefined ? { slot, stored } : { slot, stored, updatedAt }
    }),
    profiles: vault.readState().openMetadata.profiles.map(({ name }) => {
      const { stored, updatedAt } = vault.credentialStatus({ kind: 'openmetadata-profile', name })
      return updatedAt === undefined ? { name, stored } : { name, stored, updatedAt }
    })
  }
}

const status = (vault: MarketplaceVault): MarketplaceVaultHostResult => ({
  ok: true,
  status: readVaultHostStatus(vault)
})

/** Sets or replaces one token. The arguments are untrusted; the result never carries the token. */
export function setVaultHostCredential(
  vault: MarketplaceVault,
  rawArgs: unknown
): MarketplaceVaultHostResult {
  const parsed = MarketplaceVaultSet.safeParse(rawArgs)
  const token = parsed.success ? parseToken(parsed.data.token) : null
  if (!parsed.success || !token) {
    return { ok: false, reason: 'invalid-input' }
  }
  return vault.writeToken(SLOTS[parsed.data.slot], token)
    ? status(vault)
    : { ok: false, reason: 'vault-unavailable' }
}

export function clearVaultHostCredential(
  vault: MarketplaceVault,
  rawArgs: unknown
): MarketplaceVaultHostResult {
  const parsed = MarketplaceVaultClear.safeParse(rawArgs)
  if (!parsed.success) {
    return { ok: false, reason: 'invalid-input' }
  }
  vault.deleteToken(SLOTS[parsed.data.slot])
  return status(vault)
}

/**
 * Sets or replaces the token of an extra OpenMetadata profile this host already lists. A profile
 * the host does not list is refused: its token would be stored but never reach an agent.
 */
export function setVaultHostProfileCredential(
  vault: MarketplaceVault,
  rawArgs: unknown
): MarketplaceVaultHostResult {
  const parsed = MarketplaceVaultSetProfile.safeParse(rawArgs)
  const name = parsed.success ? parseProfileName(parsed.data.name) : null
  const token = parsed.success ? parseToken(parsed.data.token) : null
  if (!name || !token || !vault.readState().openMetadata.profiles.some((p) => p.name === name)) {
    return { ok: false, reason: 'invalid-input' }
  }
  return vault.writeToken({ kind: 'openmetadata-profile', name }, token)
    ? status(vault)
    : { ok: false, reason: 'vault-unavailable' }
}

/** Drops the token only; the profile and its agent entries stay until it is removed. */
export function clearVaultHostProfileCredential(
  vault: MarketplaceVault,
  rawArgs: unknown
): MarketplaceVaultHostResult {
  const parsed = MarketplaceVaultClearProfile.safeParse(rawArgs)
  const name = parsed.success ? parseProfileName(parsed.data.name) : null
  if (!name) {
    return { ok: false, reason: 'invalid-input' }
  }
  vault.deleteToken({ kind: 'openmetadata-profile', name })
  return status(vault)
}
