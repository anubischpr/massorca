import { defineMethod } from '../core'
import {
  BotTeamAddBot,
  BotTeamCreate,
  BotTeamRemoveBot,
  BotTeamSelector,
  BotTeamUpdate
} from '../../../../shared/rpc-contract/bot-team-params'

export const BOT_TEAM_METHODS = [
  defineMethod({
    name: 'botTeams.list',
    permission: 'workspace',
    params: null,
    handler: (_params, { runtime }) => ({
      teams: runtime.getOrchestrationDb().listBotTeams()
    })
  }),
  defineMethod({
    name: 'botTeams.create',
    permission: 'workspace',
    params: BotTeamCreate,
    handler: (params, { runtime }) => ({
      team: runtime.getOrchestrationDb().createBotTeam(params)
    })
  }),
  defineMethod({
    name: 'botTeams.update',
    permission: 'workspace',
    params: BotTeamUpdate,
    handler: (params, { runtime }) => ({
      team: runtime.getOrchestrationDb().updateBotTeam(params)
    })
  }),
  defineMethod({
    name: 'botTeams.delete',
    permission: 'workspace',
    params: BotTeamSelector,
    handler: (params, { runtime }) => {
      runtime.getOrchestrationDb().deleteBotTeam(params.teamId)
      return { deleted: true }
    }
  }),
  defineMethod({
    name: 'botTeams.addBot',
    permission: 'workspace',
    params: BotTeamAddBot,
    handler: (params, { runtime }) => ({
      team: runtime.getOrchestrationDb().addBotToTeam(params.teamId, params.bot)
    })
  }),
  defineMethod({
    name: 'botTeams.removeBot',
    permission: 'workspace',
    params: BotTeamRemoveBot,
    handler: (params, { runtime }) => ({
      team: runtime.getOrchestrationDb().removeBotFromTeam(params.teamId, params.botId)
    })
  })
]
