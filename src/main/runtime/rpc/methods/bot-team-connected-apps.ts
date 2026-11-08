import type { MarketplaceAppStatus } from '../../../../shared/marketplace-apps'
import {
  marketplaceAppMention,
  marketplaceAppsUsableByTeam
} from '../../../../shared/marketplace-app-mentions'
import {
  BotTeamConnectedAppsParams,
  type BotTeamConnectedAppsResult
} from '../../../../shared/rpc-contract/bot-team-connected-apps-params'
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
    params: BotTeamConnectedAppsParams,
    handler: async ({ teamId }, { runtime }): Promise<BotTeamConnectedAppsResult> => {
      const statuses = (await connectedAppsSource.listApps()).filter((status) => status.connected)
      const team = teamId
        ? runtime
            .getOrchestrationDb()
            .listBotTeams()
            .find((entry) => entry.id === teamId)
        : undefined
      // Why: the room menu is team-wide, so an app stays while any bot of the team may use it.
      const usable = team ? marketplaceAppsUsableByTeam(statuses, team) : statuses
      // Why: id and name only; statuses carry server URLs and profiles a phone must never see.
      return {
        apps: usable.map((status) => {
          const { id, name } = marketplaceAppMention(status.id)
          return { id, name }
        })
      }
    }
  })
]
