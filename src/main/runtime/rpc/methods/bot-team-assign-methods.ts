import {
  BotTeamRequestAssign,
  BotTeamTaskReassign
} from '../../../../shared/rpc-contract/bot-team-room-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import { fileBotTeamRequest } from '../../../bot-teams/bot-team-assign-request'
import { reassignBotTeamTask } from '../../../bot-teams/bot-team-reassign'
import { defineMethod, type RpcContext } from '../core'

type StartTask = (ctx: RpcContext, taskId: string) => Promise<BotTeamTask>

/** Files a request the room could not place by itself, with the bot, team or project the person chose. */
export function botTeamAssignRequestMethod(startTask: StartTask) {
  return defineMethod({
    name: 'botTeams.assignRequest',
    permission: 'workspace',
    params: BotTeamRequestAssign,
    handler: (request, ctx) =>
      fileBotTeamRequest(
        ctx.runtime.getOrchestrationDb(),
        {
          teamId: request.teamId,
          text: request.text,
          ...(request.botId !== undefined ? { botId: request.botId } : {}),
          ...(request.toTeamId !== undefined ? { toTeamId: request.toTeamId } : {}),
          ...(request.alsoNeeds !== undefined ? { alsoNeeds: request.alsoNeeds } : {}),
          ...(request.projectId !== undefined ? { projectId: request.projectId } : {}),
          ...(request.attachments !== undefined ? { attachments: request.attachments } : {}),
          start: request.start,
          later: request.later === true,
          askProject: request.askProject === true
        },
        (taskId) => startTask(ctx, taskId)
      )
  })
}

/** Gives a task nobody is working on to a bot of any team. Only its owner, and its team, change: nothing starts. */
export function botTeamReassignTaskMethod() {
  return defineMethod({
    name: 'botTeams.reassignTask',
    permission: 'workspace',
    params: BotTeamTaskReassign,
    handler: ({ taskId, botId }, ctx) => ({
      task: reassignBotTeamTask(ctx.runtime.getOrchestrationDb(), { taskId, botId }),
      startError: null
    })
  })
}

export function botTeamAssignMethods(startTask: StartTask) {
  return [botTeamAssignRequestMethod(startTask), botTeamReassignTaskMethod()]
}
