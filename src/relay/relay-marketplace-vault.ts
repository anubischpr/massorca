import {
  MARKETPLACE_VAULT_CLEAR_METHOD,
  MARKETPLACE_VAULT_SET_METHOD,
  MARKETPLACE_VAULT_STATUS_METHOD
} from '../shared/rpc-contract/marketplace-vault-params'
import {
  clearVaultHostCredential,
  readVaultHostStatus,
  setVaultHostCredential
} from '../main/marketplace/marketplace-vault-host'
import { MarketplaceVault } from '../main/marketplace/marketplace-vault'
import type { RelayDispatcher } from './dispatcher'

let relayVault: MarketplaceVault | null = null

/** This SSH host's own vault: a plain Node process has no keychain, so its key is a 0600 file. */
export function getRelayMarketplaceVault(): MarketplaceVault {
  relayVault ??= new MarketplaceVault(undefined, { sealer: () => null })
  return relayVault
}

/** Env vars for agents this host launches; empty with nothing stored, and it never throws. */
export function buildRelayMarketplaceEnv(
  vault: MarketplaceVault = getRelayMarketplaceVault()
): Record<string, string> {
  try {
    return vault.isEmpty() ? {} : vault.buildAgentEnv()
  } catch {
    return {}
  }
}

/** Tests swap the source so the real home folder is never read. */
export const relayMarketplaceEnv: { build: () => Record<string, string> } = {
  build: buildRelayMarketplaceEnv
}

/**
 * The env for a headless agent exec: this host's own vault tokens under the caller's env, so the
 * caller still wins. Null when there is nothing to add, like an exec with no env at all.
 */
export function execEnvWithMarketplace(callerEnv: unknown): Record<string, string> | null {
  const caller =
    typeof callerEnv === 'object' && callerEnv !== null && !Array.isArray(callerEnv)
      ? Object.fromEntries(
          Object.entries(callerEnv).filter(([, value]) => typeof value === 'string')
        )
      : {}
  const merged = { ...relayMarketplaceEnv.build(), ...caller }
  return Object.keys(merged).length > 0 ? merged : null
}

/**
 * Write-only management of this host's vault. An older relay lacks these methods and answers
 * `method not found`, which the desktop reports as "update MassOrca on this host first".
 */
export class MarketplaceVaultHandler {
  constructor(
    dispatcher: RelayDispatcher,
    private readonly vault: MarketplaceVault = getRelayMarketplaceVault()
  ) {
    dispatcher.onRequest(MARKETPLACE_VAULT_STATUS_METHOD, async () => ({
      ok: true,
      status: readVaultHostStatus(this.vault)
    }))
    dispatcher.onRequest(MARKETPLACE_VAULT_SET_METHOD, async (params) =>
      setVaultHostCredential(this.vault, params)
    )
    dispatcher.onRequest(MARKETPLACE_VAULT_CLEAR_METHOD, async (params) =>
      clearVaultHostCredential(this.vault, params)
    )
  }
}
