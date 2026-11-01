import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import {
  BotTeamMessagePost,
  BotTeamRoomSelector,
  BotTeamProjectCreate,
  BotTeamTaskCreate,
  BotTeamTaskSetProject,
  BotTeamTaskStart,
  type BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { chooseBotTeamLead } from '../../../../shared/bot-team-lead-selection'
import {
  buildBotTeamLeadPrompt,
  parseBotTeamLeadReply
} from '../../../../shared/bot-team-lead-query'
import { BOT_TEAMS_FOLDER_NAME } from '../../../../shared/bot-team-folder'
import { botTeamTaskTitle, routeBotTeamRequest } from '../../../../shared/bot-team-request-route'
import { createStructuredAgentSessionId } from '../../../../shared/structured-agent-session-create'
import { createStructuredAgentSessionOperationId } from '../../../../shared/structured-agent-session-mutation'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import { askDefaultAgentForBotTeamLead } from '../../../bot-teams/bot-team-lead-query'
import { startBotTeamTask } from '../../../bot-teams/bot-team-task-start'
import { getStructuredAgentSessionHost } from '../../../native-chat/agent-session-wire/structured-agent-session-registry'
import { defineMethod, type RpcContext } from '../core'
import { commitStructuredAgentSessionLaunchPrompt } from './agent-launch-structured-prompt'
import { isDefinitiveAgentSessionCreateRefusal } from '../../../../shared/agent-session-definitive-refusal'
import { createStructuredAgentSessionForWorktree } from './structured-agent-session-create'
import { structuredCallerFor } from './structured-agent-session-gate'

const BOT_TEAMS_GROUP_NAME = 'Bot teams'

async function ensureTeamWorkspace(ctx: RpcContext, team: BotTeam): Promise<string> {
  const db = ctx.runtime.getOrchestrationDb()
  const existing = db.getBotTeamWorkspace(team.id)
  if (existing) {
    return existing
  }
  const parentPath = path.join(homedir(), BOT_TEAMS_FOLDER_NAME)
  const folderPath = path.join(parentPath, team.id)
  await mkdir(folderPath, { recursive: true })
  const group =
    ctx.runtime.listProjectGroups().find((entry) => entry.parentPath === parentPath) ??
    (await ctx.runtime.createProjectGroup({ name: BOT_TEAMS_GROUP_NAME, parentPath }))
  const workspace = await ctx.runtime.createFolderWorkspace({
    projectGroupId: group.id,
    name: team.name,
    folderPath
  })
  const workspaceId = folderWorkspaceKey(workspace.id)
  db.setBotTeamWorkspace(team.id, workspaceId)
  return workspaceId
}

function requireHost() {
  const host = getStructuredAgentSessionHost()
  if (!host) {
    throw new Error('The chat host is not available.')
  }
  return host
}

async function startTaskOnHost(ctx: RpcContext, taskId: string): Promise<BotTeamTask> {
  const db = ctx.runtime.getOrchestrationDb()
  const task = db.getBotTeamTask(taskId)
  const team = db.listBotTeams().find((entry) => entry.id === task.teamId)
  if (!team) {
    throw new Error(`Team ${task.teamId} was not found.`)
  }
  await ctx.runtime.ensureStructuredAgentSessionHost()
  const caller = structuredCallerFor(ctx)
  let fence = 0
  return startBotTeamTask(
    {
      ensureTeamWorkspace: (entry) => ensureTeamWorkspace(ctx, entry),
      createSession: async ({ workspaceId, agent, accessMode, options }) => {
        const attempt = (seed: typeof options) =>
          createStructuredAgentSessionForWorktree({
            runtime: ctx.runtime,
            ensureHost: async () => requireHost(),
            caller,
            envelope: {
              sessionId: createStructuredAgentSessionId(agent, randomUUID),
              clientOperationId: createStructuredAgentSessionOperationId(randomUUID),
              expectedRuntimeFence: null,
              payloadFingerprint: ''
            },
            worktree: `id:${workspaceId}`,
            agent,
            accessMode,
            ...(seed ? { options: seed } : {}),
            // A task runs in the background; opening it is up to the person.
            activate: false
          })
        let created = await attempt(options)
        // A model this host's agent no longer offers must not block the task: it runs its default.
        if (!created.ok && options && isDefinitiveAgentSessionCreateRefusal(created.refusal.code)) {
          created = await attempt(undefined)
        }
        if (!created.ok) {
          throw new Error(created.refusal.message)
        }
        fence = created.value.fence
        return created.value.sessionId
      },
      sendPrompt: async (sessionId, text) =>
        (await commitStructuredAgentSessionLaunchPrompt({
          host: requireHost(),
          caller,
          sessionId,
          fence,
          text
        })) !== null,
      linkSession: (id, sessionId) => db.setBotTeamTaskSession(id, sessionId)
    },
    { team, task }
  )
}

/** One query over the bots' descriptions on the Settings default agent; ties go to the least busy. */
async function chooseLeadByDescription(
  ctx: RpcContext,
  team: BotTeam,
  text: string
): Promise<BotTeam['bots'][number] | null> {
  if (team.bots.length < 2) {
    return null
  }
  const reply = await askDefaultAgentForBotTeamLead({
    prompt: buildBotTeamLeadPrompt(team, team.bots, text),
    settings: ctx.runtime.getClientSettings(),
    getAgentEnvResolvers: () => ctx.runtime.getCommitMessageAgentEnvironmentResolvers()
  })
  if (reply === null) {
    return null
  }
  const activeTasksByBot: Record<string, number> = {}
  for (const task of ctx.runtime.getOrchestrationDb().listBotTeamTasks(team.id)) {
    if (task.sessionId !== null) {
      activeTasksByBot[task.ownerBotId] = (activeTasksByBot[task.ownerBotId] ?? 0) + 1
    }
  }
  return chooseBotTeamLead({
    matchedBotIds: parseBotTeamLeadReply(reply, team.bots),
    bots: team.bots,
    activeTasksByBot
  })
}

export const BOT_TEAM_ROOM_METHODS = [
  defineMethod({
    name: 'botTeams.listRoom',
    permission: 'workspace',
    params: BotTeamRoomSelector,
    handler: ({ teamId }, { runtime }) => {
      const db = runtime.getOrchestrationDb()
      return {
        tasks: db.listBotTeamTasks(teamId),
        messages: db.listBotTeamMessages(teamId),
        projects: db.listBotTeamProjects(teamId),
        // Null until a task starts; a client opens a task's session in this workspace.
        workspaceId: db.getBotTeamWorkspace(teamId)
      }
    }
  }),
  defineMethod({
    name: 'botTeams.createTask',
    permission: 'workspace',
    params: BotTeamTaskCreate,
    handler: (params, { runtime }) => ({
      task: runtime.getOrchestrationDb().createBotTeamTask(params)
    })
  }),
  defineMethod({
    name: 'botTeams.postMessage',
    permission: 'workspace',
    params: BotTeamMessagePost,
    handler: async ({ teamId, text, start }, ctx) => {
      const db = ctx.runtime.getOrchestrationDb()
      const message = db.postBotTeamMessage({ teamId, text, authorBotId: null })
      const bots = db.listBotTeams().find((entry) => entry.id === teamId)?.bots ?? []
      const team = db.listBotTeams().find((entry) => entry.id === teamId)
      const lead =
        routeBotTeamRequest(text, bots) ??
        (team ? await chooseLeadByDescription(ctx, team, text) : null)
      if (!lead) {
        return { message, task: null, startError: null }
      }
      const task = db.createBotTeamTask({
        teamId,
        title: botTeamTaskTitle(text, bots),
        prompt: text,
        ownerBotId: lead.id
      })
      if (!start) {
        return { message, task, startError: null }
      }
      try {
        return { message, task: await startTaskOnHost(ctx, task.id), startError: null }
      } catch (error) {
        // The request is kept: the task waits in Todo and can be started again.
        return { message, task, startError: error instanceof Error ? error.message : String(error) }
      }
    }
  }),
  defineMethod({
    name: 'botTeams.createProject',
    permission: 'workspace',
    params: BotTeamProjectCreate,
    handler: (params, { runtime }) => ({
      project: runtime.getOrchestrationDb().createBotTeamProject(params)
    })
  }),
  defineMethod({
    name: 'botTeams.setTaskProject',
    permission: 'workspace',
    params: BotTeamTaskSetProject,
    handler: ({ taskId, projectId }, { runtime }) => {
      runtime.getOrchestrationDb().setBotTeamTaskProject(taskId, projectId)
      return { task: runtime.getOrchestrationDb().getBotTeamTask(taskId) }
    }
  }),
  defineMethod({
    name: 'botTeams.startTask',
    permission: 'workspace',
    params: BotTeamTaskStart,
    handler: async ({ taskId }, ctx) => ({ task: await startTaskOnHost(ctx, taskId) })
  })
]
