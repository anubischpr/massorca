import type {
  MarketplaceActionResult,
  MarketplaceAppsListResult
} from '../../shared/marketplace-apps'
import type { MarketplaceAppsHostCall } from '../../shared/rpc-contract/marketplace-apps-params'
import type { MarketplaceAppsService } from './marketplace-apps-service'

export type MarketplaceAppsHostHandlers = {
  listApps: () => Promise<MarketplaceAppsListResult>
} & Record<
  Exclude<MarketplaceAppsHostCall, 'listApps'>,
  (params: unknown) => Promise<MarketplaceActionResult>
>

/**
 * What a host answers over RPC, shared by the paired-server methods and the SSH relay: the host's
 * own service, so the files it edits and the vault it reads are the ones on this host. A status
 * carries names and booleans only; no answer holds a token.
 */
export function createMarketplaceAppsHostHandlers(
  service: MarketplaceAppsService
): MarketplaceAppsHostHandlers {
  return {
    listApps: async () => {
      try {
        return { ok: true, apps: await service.listApps() }
      } catch {
        return { ok: false, reason: 'failed' }
      }
    },
    connect: (params) => service.connect(params),
    disconnect: (params) => service.disconnect(params),
    setOpenMetadataToken: (params) => service.setOpenMetadataToken(params),
    addOpenMetadataProfile: (params) => service.addOpenMetadataProfile(params),
    removeOpenMetadataProfile: (params) => service.removeOpenMetadataProfile(params),
    setEngramServer: (params) => service.setEngramServer(params),
    setAccessPolicy: (params) => service.setAccessPolicy(params)
  }
}
