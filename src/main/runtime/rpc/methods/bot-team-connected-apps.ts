import type { MarketplaceAppStatus } from '../../../../shared/marketplace-apps'
import { marketplaceAppMention } from '../../../../shared/marketplace-app-mentions'
import type { BotTeamConnectedAppsResult } from '../../../../shared/rpc-contract/bot-team-connected-apps-params'
import { createDefaultMarketplaceAppsService } from '../../../marketplace/marketplace-apps-defaults'
import type { MarketplaceAppsService } from '../../../marketplace/marketplace-apps-service'
import { defineMethod } from '../core'

let service: MarketplaceAppsService | null = null

/** Where the method reads app statuses; tests swap `listApps`. */
export const connectedAppsSource: { listApps: () => Promise<MarketplaceAppStatus[]> } = {
  listApps: () => {
    service ??= createDefaultMarketplaceAppsService()
    return service.listApps()
  }
}

export const BOT_TEAM_CONNECTED_APPS_METHODS = [
  defineMethod({
    name: 'botTeams.connectedApps',
    permission: 'workspace',
    params: null,
    handler: async (): Promise<BotTeamConnectedAppsResult> => {
      const statuses = await connectedAppsSource.listApps()
      // Why: id and name only; statuses carry server URLs and profiles a phone must never see.
      return {
        apps: statuses
          .filter((status) => status.connected)
          .map((status) => {
            const { id, name } = marketplaceAppMention(status.id)
            return { id, name }
          })
      }
    }
  })
]
