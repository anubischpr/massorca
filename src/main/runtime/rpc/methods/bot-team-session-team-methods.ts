import { listBotTeamSessionTeams } from '../../../bot-teams/bot-team-session-team'
import { defineMethod } from '../core'

export const BOT_TEAM_SESSION_TEAM_METHODS = [
  defineMethod({
    name: 'botTeams.sessionTeams',
    permission: 'workspace',
    params: null,
    handler: (_params, { runtime }) => ({
      sessionTeams: listBotTeamSessionTeams(runtime.getOrchestrationDb())
    })
  })
]
