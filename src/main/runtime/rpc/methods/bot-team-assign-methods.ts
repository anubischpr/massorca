import {
  BotTeamRequestAssign,
  BotTeamTaskReassign
} from '../../../../shared/rpc-contract/bot-team-room-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import { assignBotTeamRequest } from '../../../bot-teams/bot-team-assign-request'
import { reassignBotTeamTask } from '../../../bot-teams/bot-team-reassign'
import { defineMethod, type RpcContext } from '../core'
import { startFiled } from './bot-team-post-request'

type StartTask = (ctx: RpcContext, taskId: string) => Promise<BotTeamTask>

/** Files a request the room could not place by itself, with the bot or team the person chose. */
export function botTeamAssignRequestMethod(startTask: StartTask) {
  return defineMethod({
    name: 'botTeams.assignRequest',
    permission: 'workspace',
    params: BotTeamRequestAssign,
    handler: async ({ start, ...request }, ctx) =>
      startFiled(assignBotTeamRequest(ctx.runtime.getOrchestrationDb(), request), start, (taskId) =>
        startTask(ctx, taskId)
      )
  })
}

/** Gives a task nobody is working on to a bot of any team, who starts it fresh. */
export function botTeamReassignTaskMethod(startTask: StartTask) {
  return defineMethod({
    name: 'botTeams.reassignTask',
    permission: 'workspace',
    params: BotTeamTaskReassign,
    handler: async ({ taskId, botId, start }, ctx) =>
      startFiled(
        reassignBotTeamTask(ctx.runtime.getOrchestrationDb(), { taskId, botId }),
        start,
        (id) => startTask(ctx, id)
      )
  })
}

export function botTeamAssignMethods(startTask: StartTask) {
  return [botTeamAssignRequestMethod(startTask), botTeamReassignTaskMethod(startTask)]
}
