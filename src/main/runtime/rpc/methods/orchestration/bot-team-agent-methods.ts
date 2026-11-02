import { OrchestrationError } from '../../../orchestration/orchestration-error'
import type { BotTeamTask } from '../../../../../shared/rpc-contract/bot-team-room-params'
import {
  BotTeamAgentDelegate,
  BotTeamAgentPost,
  BotTeamAgentTaskCreate
} from '../../../../../shared/rpc-contract/bot-team-agent-params'
import { botTeamTaskTitle, routeBotTeamRequest } from '../../../../../shared/bot-team-request-route'
import { delegateToBotTeammate } from '../../../../bot-teams/bot-team-delegate'
import {
  getDelegationAnswerService,
  getDelegationRequestService
} from '../../../../delegated-session/delegation-runtime'
import { defineMethod } from '../../core'

/** The task a calling chat runs, which says which team and bot it speaks for. */
export function requireBotTeamCallerTask(
  db: { findBotTeamTaskBySession: (sessionId: string) => BotTeamTask | null },
  sessionId: string | undefined
): BotTeamTask {
  const task = sessionId ? db.findBotTeamTaskBySession(sessionId) : null
  if (!task) {
    throw new OrchestrationError(
      'invalid_argument',
      'Only a chat that runs a Bot teams task can use this command. No effects were applied.',
      { effectsApplied: false }
    )
  }
  return task
}

export const ORCHESTRATION_BOT_TEAM_METHODS = [
  defineMethod({
    name: 'orchestration.botTeamDelegate',
    permission: 'workspace',
    params: BotTeamAgentDelegate,
    handler: async ({ bot, text }, { runtime, orchestrationCaller }) => {
      const db = runtime.getOrchestrationDb()
      const caller = requireBotTeamCallerTask(db, orchestrationCaller?.sessionId)
      const team = db.listBotTeams().find((entry) => entry.id === caller.teamId)
      if (!team) {
        throw new OrchestrationError('invalid_argument', 'This team no longer exists.', {
          effectsApplied: false
        })
      }
      await runtime.ensureStructuredAgentSessionHost()
      return {
        task: await delegateToBotTeammate(
          {
            fileRequest: (request) =>
              getDelegationRequestService(runtime).requestForAgent({
                parentSessionId: caller.sessionId ?? '',
                summary: request.title,
                prompt: request.prompt,
                title: request.title,
                writes: false,
                agent: request.agent,
                ...(request.launch ? { launch: request.launch } : {}),
                ...(request.piRuntime ? { piRuntime: request.piRuntime } : {})
              }),
            createTask: (args) => db.createBotTeamTask({ teamId: team.id, ...args }),
            linkTask: (taskId, requestId) => db.linkBotTeamTaskDelegation(taskId, requestId),
            startRequest: (requestId, agent) =>
              getDelegationAnswerService(runtime).startChosenAgent(requestId, agent)
          },
          { team, botName: bot, text }
        )
      }
    }
  }),
  defineMethod({
    name: 'orchestration.botTeamPost',
    permission: 'workspace',
    params: BotTeamAgentPost,
    handler: ({ text }, { runtime, orchestrationCaller }) => {
      const db = runtime.getOrchestrationDb()
      const task = requireBotTeamCallerTask(db, orchestrationCaller?.sessionId)
      return {
        message: db.postBotTeamMessage({
          teamId: task.teamId,
          authorBotId: task.ownerBotId,
          text
        })
      }
    }
  }),
  defineMethod({
    name: 'orchestration.botTeamTasks',
    permission: 'workspace',
    params: null,
    handler: (_params, { runtime, orchestrationCaller }) => {
      const db = runtime.getOrchestrationDb()
      const task = requireBotTeamCallerTask(db, orchestrationCaller?.sessionId)
      return { tasks: db.listBotTeamTasks(task.teamId) }
    }
  }),
  defineMethod({
    name: 'orchestration.botTeamTaskCreate',
    permission: 'workspace',
    params: BotTeamAgentTaskCreate,
    handler: ({ text }, { runtime, orchestrationCaller }) => {
      const db = runtime.getOrchestrationDb()
      const caller = requireBotTeamCallerTask(db, orchestrationCaller?.sessionId)
      const bots = db.listBotTeams().find((team) => team.id === caller.teamId)?.bots ?? []
      // The caller keeps the task unless the text mentions a teammate. It waits in Todo (S10).
      const owner = routeBotTeamRequest(text, bots)?.id ?? caller.ownerBotId
      return {
        task: db.createBotTeamTask({
          teamId: caller.teamId,
          title: botTeamTaskTitle(text, bots),
          prompt: text,
          ownerBotId: owner
        })
      }
    }
  })
]
