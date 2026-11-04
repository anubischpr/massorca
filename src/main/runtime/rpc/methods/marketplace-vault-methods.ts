import {
  MARKETPLACE_VAULT_CLEAR_METHOD,
  MARKETPLACE_VAULT_SET_METHOD,
  MARKETPLACE_VAULT_STATUS_METHOD,
  MarketplaceVaultClear,
  MarketplaceVaultSet
} from '../../../../shared/rpc-contract/marketplace-vault-params'
import type { MarketplaceVaultHostResult } from '../../../../shared/marketplace-apps'
import {
  clearVaultHostCredential,
  readVaultHostStatus,
  setVaultHostCredential
} from '../../../marketplace/marketplace-vault-host'
import { getMarketplaceVault, type MarketplaceVault } from '../../../marketplace/marketplace-vault'
import { defineMethod } from '../core'

/** Tests swap the vault so the real home folder is never touched. */
export const marketplaceVaultHost: { vault: () => MarketplaceVault } = {
  vault: getMarketplaceVault
}

// Why: a client without these methods gets `method_not_found` from an older host, which it reads as
// "update MassOrca on this host first"; the methods are the capability. Tokens are write-only.
export const marketplaceVaultStatusMethod = defineMethod({
  name: MARKETPLACE_VAULT_STATUS_METHOD,
  permission: 'accounts-admin',
  params: null,
  handler: async (): Promise<MarketplaceVaultHostResult> => ({
    ok: true,
    status: readVaultHostStatus(marketplaceVaultHost.vault())
  })
})

export const marketplaceVaultSetMethod = defineMethod({
  name: MARKETPLACE_VAULT_SET_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceVaultSet,
  handler: async (params): Promise<MarketplaceVaultHostResult> =>
    setVaultHostCredential(marketplaceVaultHost.vault(), params)
})

export const marketplaceVaultClearMethod = defineMethod({
  name: MARKETPLACE_VAULT_CLEAR_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceVaultClear,
  handler: async (params): Promise<MarketplaceVaultHostResult> =>
    clearVaultHostCredential(marketplaceVaultHost.vault(), params)
})

export const MARKETPLACE_VAULT_METHODS = [
  marketplaceVaultStatusMethod,
  marketplaceVaultSetMethod,
  marketplaceVaultClearMethod
]
