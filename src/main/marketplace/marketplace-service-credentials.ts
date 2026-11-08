import {
  getMarketplaceVault,
  type MarketplaceVault,
  type VaultTokenService
} from './marketplace-vault'

export type StoredServiceCredential = { token: string | null; baseUrl: string | null }

const NOTHING: StoredServiceCredential = { token: null, baseUrl: null }

/** Tests swap the vault so the real home folder is never read. */
export const storedServiceCredentials: { vault: () => MarketplaceVault } = {
  vault: getMarketplaceVault
}

/**
 * The token and address saved in this host's vault. Source-control calls read it before the
 * environment, so a saved credential wins and an environment-only setup keeps working.
 */
export function readStoredServiceCredential(service: VaultTokenService): StoredServiceCredential {
  try {
    const vault = storedServiceCredentials.vault()
    // Why: most hosts store nothing, and every API call asks, so skip the key and decrypt work.
    if (vault.isEmpty()) {
      return NOTHING
    }
    return {
      token: vault.readToken({ kind: 'service-token', service }),
      baseUrl: vault.readToken({ kind: 'service-url', service })
    }
  } catch {
    return NOTHING
  }
}

/** Replaces both values; an address left out clears the one saved before. False when nothing was written. */
export function writeStoredServiceCredential(
  vault: MarketplaceVault,
  service: VaultTokenService,
  credential: { token: string; baseUrl?: string }
): boolean {
  if (!vault.writeToken({ kind: 'service-token', service }, credential.token)) {
    return false
  }
  if (credential.baseUrl === undefined) {
    vault.deleteToken({ kind: 'service-url', service })
    return true
  }
  if (vault.writeToken({ kind: 'service-url', service }, credential.baseUrl)) {
    return true
  }
  clearStoredServiceCredential(vault, service)
  return false
}

export function clearStoredServiceCredential(
  vault: MarketplaceVault,
  service: VaultTokenService
): void {
  vault.deleteToken({ kind: 'service-token', service })
  vault.deleteToken({ kind: 'service-url', service })
}
