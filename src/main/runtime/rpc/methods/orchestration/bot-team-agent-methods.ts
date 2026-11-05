import { OrchestrationError } from '../../../orchestration/orchestration-error'
import type {
  BotTeamProject,
  BotTeamTask
} from '../../../../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../../../orchestration/db/orchestration-db'
import {
  BotTeamAgentDelegate,
  BotTeamAgentPost,
  BotTeamAgentRemember,
  BotTeamAgentTaskCreate
} from '../../../../../shared/rpc-contract/bot-team-agent-params'
import { botTeamClockNoteIn } from '../../../../../shared/bot-team-person-clock'
import { botTeamTaskTitle, routeBotTeamRequest } from '../../../../../shared/bot-team-request-route'
import { readBotTeamMemoryLines } from '../../../../bot-teams/bot-team-memory-read'
import { botTeamRoomExcerpt } from '../../../../bot-teams/bot-team-prompt-notes'
import { delegateToBotTeammate, findDelegationTeam } from '../../../../bot-teams/bot-team-delegate'
import { findHandedOverBotTeamTask } from '../../../orchestration/db/bot-teams/bot-team-task-delegation-store'
import {
  getDelegationAnswerService,
  getDelegationRequestService
} from '../../../../delegated-session/delegation-runtime'
import { deniedMarketplaceAppIdsForBot } from '../../../../marketplace/marketplace-bot-run-denial'
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

/** The caller's project, which only a teammate on the same team works under; shared and archived count. */
export function botTeamDelegationProject(
  db: OrchestrationDb,
  caller: Pick<BotTeamTask, 'teamId' | 'projectId'>,
  teamId: string
): BotTeamProject | null {
  if (teamId !== caller.teamId || !caller.projectId) {
    return null
  }
  return (
    db
      .listBotTeamProjects(teamId, { includeLinked: true, includeArchived: true })
      .find((entry) => entry.id === caller.projectId) ?? null
  )
}

const LAUNCH_WAIT_MS = 20_000
const LAUNCH_POLL_MS = 200

/** Waits for a filed request to leave pending/starting, so a refused launch reaches the caller. */
export async function waitForDelegationLaunch(
  db: {
    getDelegationRequest: (id: string) => { status: string; failure: string | null } | undefined
  },
  requestId: string,
  { timeoutMs = LAUNCH_WAIT_MS, pollMs = LAUNCH_POLL_MS } = {}
): Promise<{ failed: string | null }> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const row = db.getDelegationRequest(requestId)
    if (row && row.status !== 'pending' && row.status !== 'starting') {
      return {
        failed:
          row.status === 'failed' || row.status === 'cancelled'
            ? (row.failure ?? 'The launch was refused.')
            : null
      }
    }
    if (Date.now() >= deadline) {
      return { failed: null }
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
}

export const ORCHESTRATION_BOT_TEAM_METHODS = [
  defineMethod({
    name: 'orchestration.botTeamDelegate',
    permission: 'workspace',
    params: BotTeamAgentDelegate,
    handler: async ({ bot, text, team: teamName }, { runtime, orchestrationCaller }) => {
      const db = runtime.getOrchestrationDb()
      const caller = requireBotTeamCallerTask(db, orchestrationCaller?.sessionId)
      let team
      try {
        team = findDelegationTeam(db.listBotTeams(), caller.teamId, teamName)
      } catch (error) {
        throw new OrchestrationError(
          'invalid_argument',
          error instanceof Error ? error.message : String(error),
          { effectsApplied: false }
        )
      }
      const project = botTeamDelegationProject(db, caller, team.id)
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
            createTask: (args) => {
              const created = db.createBotTeamTask({ teamId: team.id, ...args })
              if (!project) {
                return created
              }
              db.setBotTeamTaskProject(created.id, project.id)
              return db.getBotTeamTask(created.id)
            },
            memoryFor: (botId) => readBotTeamMemoryLines(db, team.id, botId),
            linkTask: (taskId, requestId) => db.linkBotTeamTaskDelegation(taskId, requestId),
            startRequest: (requestId, agent) =>
              getDelegationAnswerService(runtime).startChosenAgent(requestId, agent),
            launchOutcome: (requestId) => waitForDelegationLaunch(db, requestId),
            alreadyHandedOver: (ownerBotId, prompt) =>
              findHandedOverBotTeamTask(db, {
                parentSessionId: caller.sessionId ?? '',
                ownerBotId,
                prompt
              })
          },
          {
            team,
            botName: bot,
            text,
            project,
            roomExcerpt: botTeamRoomExcerpt(db.listBotTeamMessages(team.id), team.bots),
            clock: botTeamClockNoteIn(db.getBotTeamTaskStartNotes(caller.id)),
            deniedMarketplaceApps: await deniedMarketplaceAppIdsForBot({
              botId:
                team.bots.find((entry) => entry.name.toLowerCase() === bot.toLowerCase())?.id ?? '',
              teamId: team.id
            })
          }
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
    name: 'orchestration.botTeamRemember',
    permission: 'workspace',
    params: BotTeamAgentRemember,
    handler: ({ text, me, told }, { runtime, orchestrationCaller }) => {
      const db = runtime.getOrchestrationDb()
      const task = requireBotTeamCallerTask(db, orchestrationCaller?.sessionId)
      return {
        memory: db.addBotTeamMemory({
          teamId: task.teamId,
          botId: me ? task.ownerBotId : null,
          text,
          source: { kind: told ? 'person' : 'task', taskTitle: told ? null : task.title }
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
      const task = db.createBotTeamTask({
        teamId: caller.teamId,
        title: botTeamTaskTitle(text, bots),
        prompt: text,
        ownerBotId: owner
      })
      // The saved work reads its days on the clock the caller's request was asked on.
      const clock = botTeamClockNoteIn(db.getBotTeamTaskStartNotes(caller.id))
      if (clock) {
        db.setBotTeamTaskStartNotes(task.id, clock)
      }
      // Work a task saves for later belongs to the same project as that task.
      if (!caller.projectId) {
        return { task }
      }
      db.setBotTeamTaskProject(task.id, caller.projectId)
      return { task: db.getBotTeamTask(task.id) }
    }
  })
]
