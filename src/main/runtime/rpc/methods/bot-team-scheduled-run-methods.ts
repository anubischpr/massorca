import { BotTeamScheduledRunsQuery } from '../../../../shared/rpc-contract/bot-team-scheduled-run-params'
import { listBotTeamScheduledRuns } from '../../../bot-teams/bot-team-scheduled-runs'
import { defineMethod } from '../core'

/** The upcoming routine runs a calendar shows, read on the host that schedules them. */
export const botTeamListScheduledRunsMethod = defineMethod({
  name: 'botTeams.listScheduledRuns',
  permission: 'workspace',
  params: BotTeamScheduledRunsQuery,
  handler: (query, { runtime }) =>
    listBotTeamScheduledRuns(runtime.getOrchestrationDb(), query, Date.now())
})
