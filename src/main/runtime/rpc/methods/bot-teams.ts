import { defineMethod } from '../core'
import { assertBotAgentSwitchAllowed } from '../../../bot-teams/bot-team-agent-switch-guard'
import {
  BotTeamAddBot,
  BotTeamCreate,
  BotTeamRemoveBot,
  BotTeamUpdateBot,
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
    handler: async (params, { runtime }) => {
      // A new team and its bots have no ids yet, so only "only these" rules can block them.
      for (const bot of params.bots) {
        await assertBotAgentSwitchAllowed({ teams: [], teamId: '', botId: '', agent: bot.agent })
      }
      return { team: runtime.getOrchestrationDb().createBotTeam(params) }
    }
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
    handler: async (params, { runtime }) => {
      const db = runtime.getOrchestrationDb()
      await assertBotAgentSwitchAllowed({
        teams: db.listBotTeams(),
        teamId: params.teamId,
        botId: '',
        agent: params.bot.agent
      })
      return { team: db.addBotToTeam(params.teamId, params.bot) }
    }
  }),
  defineMethod({
    name: 'botTeams.updateBot',
    permission: 'workspace',
    params: BotTeamUpdateBot,
    handler: async (params, { runtime }) => {
      const db = runtime.getOrchestrationDb()
      await assertBotAgentSwitchAllowed({
        teams: db.listBotTeams(),
        teamId: params.teamId,
        botId: params.botId,
        agent: params.bot.agent
      })
      return { team: db.updateBotOnTeam(params.teamId, params.botId, params.bot) }
    }
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
