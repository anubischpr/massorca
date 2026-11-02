import { BotTeamRequestAssign } from '../../../../shared/rpc-contract/bot-team-room-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import { assignBotTeamRequest } from '../../../bot-teams/bot-team-assign-request'
import { defineMethod, type RpcContext } from '../core'

/** The methods that place a request the room could not place by itself. */
export function botTeamAssignMethods(
  startTask: (ctx: RpcContext, taskId: string) => Promise<BotTeamTask>
) {
  return [
    defineMethod({
      name: 'botTeams.assignRequest',
      permission: 'workspace',
      params: BotTeamRequestAssign,
      handler: async ({ start, ...request }, ctx) => {
        const task = assignBotTeamRequest(ctx.runtime.getOrchestrationDb(), request)
        if (!start) {
          return { task, startError: null }
        }
        try {
          return { task: await startTask(ctx, task.id), startError: null }
        } catch (error) {
          // The request is kept: the task waits in Todo and can be started again.
          return { task, startError: error instanceof Error ? error.message : String(error) }
        }
      }
    })
  ]
}
