import {
  MARKETPLACE_SERVICE_CONNECT_METHOD,
  MARKETPLACE_SERVICE_DISCONNECT_METHOD,
  MARKETPLACE_SERVICE_STATUS_METHOD,
  MarketplaceServiceConnect,
  MarketplaceServiceDisconnect
} from '../../../../shared/rpc-contract/marketplace-service-params'
import type { MarketplaceServicesResult } from '../../../../shared/marketplace-services'
import {
  connectMarketplaceService,
  disconnectMarketplaceService,
  readMarketplaceServices
} from '../../../marketplace/marketplace-services'
import { marketplaceVaultHost } from './marketplace-vault-methods'
import { defineMethod } from '../core'

// Why: a client without these methods gets `method_not_found` from an older host, which it reads as
// "update MassOrca on this host first"; the methods are the capability. Tokens are write-only.
export const marketplaceServiceStatusMethod = defineMethod({
  name: MARKETPLACE_SERVICE_STATUS_METHOD,
  permission: 'accounts-admin',
  params: null,
  handler: async (): Promise<MarketplaceServicesResult> =>
    readMarketplaceServices(marketplaceVaultHost.vault())
})

export const marketplaceServiceConnectMethod = defineMethod({
  name: MARKETPLACE_SERVICE_CONNECT_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceServiceConnect,
  handler: async (params): Promise<MarketplaceServicesResult> =>
    connectMarketplaceService(marketplaceVaultHost.vault(), params)
})

export const marketplaceServiceDisconnectMethod = defineMethod({
  name: MARKETPLACE_SERVICE_DISCONNECT_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceServiceDisconnect,
  handler: async (params): Promise<MarketplaceServicesResult> =>
    disconnectMarketplaceService(marketplaceVaultHost.vault(), params)
})

export const MARKETPLACE_SERVICE_METHODS = [
  marketplaceServiceStatusMethod,
  marketplaceServiceConnectMethod,
  marketplaceServiceDisconnectMethod
]
