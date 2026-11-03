import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import {
  BotTeamMessagePost,
  BotTeamRoomListSelector,
  BotTeamRoomSelector,
  BotTeamProjectCreate,
  BotTeamProjectSetBrief,
  BotTeamProjectSetCodeSource,
  BotTeamTaskCreate,
  BotTeamTaskSetProject,
  BotTeamTaskStart,
  type BotTeamTask
} from '../../../../shared/rpc-contract/bot-team-room-params'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { createStructuredAgentSessionId } from '../../../../shared/structured-agent-session-create'
import { createStructuredAgentSessionOperationId } from '../../../../shared/structured-agent-session-mutation'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import { ensureBotTeamVersionWatcher } from '../../../bot-teams/bot-team-task-versions'
import { botTeamFolderPath, botTeamsParentPath } from '../../../bot-teams/bot-team-version-deps'
import { readBotTeamMemoryLines } from '../../../bot-teams/bot-team-memory-read'
import { botSessionOptions } from '../../../bot-teams/bot-team-model-choice'
import { startBotTeamTask } from '../../../bot-teams/bot-team-task-start'
import {
  linkedTaskWorkspaceDeps,
  prepareLinkedTaskWorkspace
} from '../../../bot-teams/bot-team-task-worktree'
import { getStructuredAgentSessionHost } from '../../../native-chat/agent-session-wire/structured-agent-session-registry'
import { defineMethod, type RpcContext } from '../core'
import { botTeamAssignMethods } from './bot-team-assign-methods'
import { BOT_TEAM_MEMORY_METHODS } from './bot-team-memory-methods'
import { BOT_TEAM_PROJECT_METHODS, roomProjectsFor } from './bot-team-project-methods'
import { postBotTeamRequestOnHost } from './bot-team-post-request'
import { listBotTeamReplying, rememberBotTeamPost } from './bot-team-reply-in-flight'
import { BOT_TEAM_VERSION_METHODS } from './bot-team-versions'
import { commitStructuredAgentSessionLaunchPrompt } from './agent-launch-structured-prompt'
import { isDefinitiveAgentSessionCreateRefusal } from '../../../../shared/agent-session-definitive-refusal'
import { createStructuredAgentSessionForWorktree } from './structured-agent-session-create'
import { structuredCallerFor } from './structured-agent-session-gate'
import { BOT_TEAM_PROJECT_WORKSPACE_METHODS } from './bot-team-project-workspace'
import { BOT_TEAM_SESSION_TEAM_METHODS } from './bot-team-session-team-methods'

const BOT_TEAMS_GROUP_NAME = 'Bot teams'

const workspacesBeingMade = new Map<string, Promise<string>>()
const tasksBeingStarted = new Set<string>()

/** Two first requests at once must share one workspace: the later would replace the earlier. */
async function ensureTeamWorkspace(ctx: RpcContext, team: BotTeam): Promise<string> {
  const existing = ctx.runtime.getOrchestrationDb().getBotTeamWorkspace(team.id)
  if (existing) {
    return existing
  }
  const making =
    workspacesBeingMade.get(team.id) ??
    makeTeamWorkspace(ctx, team).finally(() => workspacesBeingMade.delete(team.id))
  workspacesBeingMade.set(team.id, making)
  return making
}

async function makeTeamWorkspace(ctx: RpcContext, team: BotTeam): Promise<string> {
  const db = ctx.runtime.getOrchestrationDb()
  const parentPath = botTeamsParentPath()
  const folderPath = botTeamFolderPath(team.id)
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

export async function startTaskOnHost(ctx: RpcContext, taskId: string): Promise<BotTeamTask> {
  if (
    tasksBeingStarted.has(taskId) ||
    ctx.runtime.getOrchestrationDb().isBotTeamTaskHandedOff(taskId)
  ) {
    throw new Error('This task is already starting.')
  }
  tasksBeingStarted.add(taskId)
  try {
    return await startUnclaimedTaskOnHost(ctx, taskId)
  } finally {
    tasksBeingStarted.delete(taskId)
  }
}

async function startUnclaimedTaskOnHost(ctx: RpcContext, taskId: string): Promise<BotTeamTask> {
  const db = ctx.runtime.getOrchestrationDb()
  const task = db.getBotTeamTask(taskId)
  const team = db.listBotTeams().find((entry) => entry.id === task.teamId)
  if (!team) {
    throw new Error(`Team ${task.teamId} was not found.`)
  }
  await ctx.runtime.ensureStructuredAgentSessionHost()
  ensureBotTeamVersionWatcher(() => ctx.runtime.getOrchestrationDb())
  const caller = structuredCallerFor(ctx)
  let fence = 0
  return startBotTeamTask(
    {
      ensureTeamWorkspace: (entry) => ensureTeamWorkspace(ctx, entry),
      prepareLinkedWorkspace: ({ projectId, workspaceKey, taskTitle, taskPrompt }) =>
        prepareLinkedTaskWorkspace(linkedTaskWorkspaceDeps(ctx.runtime), {
          projectId,
          workspaceKey,
          taskTitle,
          taskPrompt
        }),
      createSession: async ({ workspaceId, agent, accessMode, piRuntime, options }) => {
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
            ...(piRuntime ? { piRuntime } : {}),
            options: botSessionOptions(seed, accessMode),
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
    {
      team,
      task,
      // By id: a team unlinked from the project still keeps its task there, with the brief.
      project: task.projectId ? db.getBotTeamProject(task.projectId) : null,
      notes: db.getBotTeamTaskStartNotes(task.id),
      memory: readBotTeamMemoryLines(db, team.id, task.ownerBotId)
    }
  )
}

export const BOT_TEAM_ROOM_METHODS = [
  ...BOT_TEAM_SESSION_TEAM_METHODS,
  ...BOT_TEAM_VERSION_METHODS,
  ...botTeamAssignMethods(startTaskOnHost),
  ...BOT_TEAM_MEMORY_METHODS,
  ...BOT_TEAM_PROJECT_WORKSPACE_METHODS,
  ...BOT_TEAM_PROJECT_METHODS,
  defineMethod({
    name: 'botTeams.listRoom',
    permission: 'workspace',
    params: BotTeamRoomListSelector,
    handler: ({ teamId, withLinkedProjects }, { runtime }) => {
      const db = runtime.getOrchestrationDb()
      // Rooms are read all the time, so this also covers tasks that outlive a restart.
      ensureBotTeamVersionWatcher(() => runtime.getOrchestrationDb())
      return {
        tasks: db.listBotTeamTasks(teamId),
        messages: db.listBotTeamMessages(teamId),
        ...roomProjectsFor(db, { teamId, withLinkedProjects }),
        // Null until a task starts; a client opens a task's session in this workspace.
        workspaceId: db.getBotTeamWorkspace(teamId),
        // The bots answering in the background; a client from before it ignores the field.
        replying: listBotTeamReplying(teamId)
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
    handler: (params, ctx) =>
      rememberBotTeamPost(params.teamId, params.clientRequestId, () =>
        postBotTeamRequestOnHost(ctx, params, (id) => startTaskOnHost(ctx, id))
      )
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
    name: 'botTeams.workspace',
    permission: 'workspace',
    params: BotTeamRoomSelector,
    // Null until a task starts: listing a team's files never creates its folder.
    handler: ({ teamId }, { runtime }) => ({
      workspaceId: runtime.getOrchestrationDb().getBotTeamWorkspace(teamId)
    })
  }),
  defineMethod({
    name: 'botTeams.setProjectBrief',
    permission: 'workspace',
    params: BotTeamProjectSetBrief,
    handler: ({ projectId, goal, brief }, { runtime }) => ({
      project: runtime.getOrchestrationDb().setBotTeamProjectBrief(projectId, { goal, brief })
    })
  }),
  defineMethod({
    name: 'botTeams.setProjectCodeSource',
    permission: 'workspace',
    params: BotTeamProjectSetCodeSource,
    handler: ({ projectId, codeSource }, { runtime }) => ({
      project: runtime.getOrchestrationDb().setBotTeamProjectCodeSource(projectId, codeSource)
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
