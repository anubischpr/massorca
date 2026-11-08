import {
  MARKETPLACE_VAULT_CLEAR_METHOD,
  MARKETPLACE_VAULT_CLEAR_PROFILE_METHOD,
  MARKETPLACE_VAULT_SET_METHOD,
  MARKETPLACE_VAULT_SET_PROFILE_METHOD,
  MARKETPLACE_VAULT_STATUS_METHOD,
  MarketplaceVaultClear,
  MarketplaceVaultClearProfile,
  MarketplaceVaultSet,
  MarketplaceVaultSetProfile
} from '../../../../shared/rpc-contract/marketplace-vault-params'
import type { MarketplaceVaultHostResult } from '../../../../shared/marketplace-apps'
import {
  clearVaultHostCredential,
  clearVaultHostProfileCredential,
  readVaultHostStatus,
  setVaultHostCredential,
  setVaultHostProfileCredential
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

// Why: a profile token has its own methods so an older host answers `method_not_found`, which the
// client turns into "update MassOrca on this host"; the existing methods keep their old shape.
export const marketplaceVaultSetProfileMethod = defineMethod({
  name: MARKETPLACE_VAULT_SET_PROFILE_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceVaultSetProfile,
  handler: async (params): Promise<MarketplaceVaultHostResult> =>
    setVaultHostProfileCredential(marketplaceVaultHost.vault(), params)
})

export const marketplaceVaultClearProfileMethod = defineMethod({
  name: MARKETPLACE_VAULT_CLEAR_PROFILE_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceVaultClearProfile,
  handler: async (params): Promise<MarketplaceVaultHostResult> =>
    clearVaultHostProfileCredential(marketplaceVaultHost.vault(), params)
})

export const MARKETPLACE_VAULT_METHODS = [
  marketplaceVaultStatusMethod,
  marketplaceVaultSetMethod,
  marketplaceVaultClearMethod,
  marketplaceVaultSetProfileMethod,
  marketplaceVaultClearProfileMethod
]
