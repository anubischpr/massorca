import type {
  MarketplaceActionResult,
  MarketplaceAppsListResult
} from '../../../../shared/marketplace-apps'
import {
  MARKETPLACE_APPS_ADD_OPENMETADATA_PROFILE_METHOD,
  MARKETPLACE_APPS_CONNECT_METHOD,
  MARKETPLACE_APPS_DISCONNECT_METHOD,
  MARKETPLACE_APPS_LIST_METHOD,
  MARKETPLACE_APPS_REMOVE_OPENMETADATA_PROFILE_METHOD,
  MARKETPLACE_APPS_SET_ACCESS_POLICY_METHOD,
  MARKETPLACE_APPS_SET_ENGRAM_SERVER_METHOD,
  MARKETPLACE_APPS_SET_OPENMETADATA_TOKEN_METHOD,
  MarketplaceAppsAddOpenMetadataProfile,
  MarketplaceAppsConnect,
  MarketplaceAppsDisconnect,
  MarketplaceAppsRemoveOpenMetadataProfile,
  MarketplaceAppsSetAccessPolicy,
  MarketplaceAppsSetEngramServer,
  MarketplaceAppsSetOpenMetadataToken
} from '../../../../shared/rpc-contract/marketplace-apps-params'
import { createMarketplaceAppsHostHandlers } from '../../../marketplace/marketplace-apps-host-methods'
import { createDefaultMarketplaceAppsService } from '../../../marketplace/marketplace-apps-defaults'
import type { MarketplaceAppsService } from '../../../marketplace/marketplace-apps-service'
import { defineMethod } from '../core'

/** Tests swap the service so the real home folder is never touched. */
export const marketplaceAppsHost: { service: () => MarketplaceAppsService } = {
  service: createDefaultMarketplaceAppsService
}

const handlers = (): ReturnType<typeof createMarketplaceAppsHostHandlers> =>
  createMarketplaceAppsHostHandlers(marketplaceAppsHost.service())

// Why: a client without these methods gets `method_not_found` from an older host, which it reads as
// "update MassOrca on this host first"; the methods are the capability. Changes stay desktop-only.
export const marketplaceAppsListMethod = defineMethod({
  name: MARKETPLACE_APPS_LIST_METHOD,
  permission: 'accounts-admin',
  params: null,
  handler: async (): Promise<MarketplaceAppsListResult> => handlers().listApps()
})

export const marketplaceAppsConnectMethod = defineMethod({
  name: MARKETPLACE_APPS_CONNECT_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceAppsConnect,
  handler: async (params): Promise<MarketplaceActionResult> => handlers().connect(params)
})

export const marketplaceAppsDisconnectMethod = defineMethod({
  name: MARKETPLACE_APPS_DISCONNECT_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceAppsDisconnect,
  handler: async (params): Promise<MarketplaceActionResult> => handlers().disconnect(params)
})

export const marketplaceAppsSetOpenMetadataTokenMethod = defineMethod({
  name: MARKETPLACE_APPS_SET_OPENMETADATA_TOKEN_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceAppsSetOpenMetadataToken,
  handler: async (params): Promise<MarketplaceActionResult> =>
    handlers().setOpenMetadataToken(params)
})

export const marketplaceAppsAddOpenMetadataProfileMethod = defineMethod({
  name: MARKETPLACE_APPS_ADD_OPENMETADATA_PROFILE_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceAppsAddOpenMetadataProfile,
  handler: async (params): Promise<MarketplaceActionResult> =>
    handlers().addOpenMetadataProfile(params)
})

export const marketplaceAppsRemoveOpenMetadataProfileMethod = defineMethod({
  name: MARKETPLACE_APPS_REMOVE_OPENMETADATA_PROFILE_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceAppsRemoveOpenMetadataProfile,
  handler: async (params): Promise<MarketplaceActionResult> =>
    handlers().removeOpenMetadataProfile(params)
})

export const marketplaceAppsSetEngramServerMethod = defineMethod({
  name: MARKETPLACE_APPS_SET_ENGRAM_SERVER_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceAppsSetEngramServer,
  handler: async (params): Promise<MarketplaceActionResult> => handlers().setEngramServer(params)
})

export const marketplaceAppsSetAccessPolicyMethod = defineMethod({
  name: MARKETPLACE_APPS_SET_ACCESS_POLICY_METHOD,
  permission: 'accounts-admin',
  params: MarketplaceAppsSetAccessPolicy,
  handler: async (params): Promise<MarketplaceActionResult> => handlers().setAccessPolicy(params)
})

export const MARKETPLACE_APPS_METHODS = [
  marketplaceAppsListMethod,
  marketplaceAppsConnectMethod,
  marketplaceAppsDisconnectMethod,
  marketplaceAppsSetOpenMetadataTokenMethod,
  marketplaceAppsAddOpenMetadataProfileMethod,
  marketplaceAppsRemoveOpenMetadataProfileMethod,
  marketplaceAppsSetEngramServerMethod,
  marketplaceAppsSetAccessPolicyMethod
]
