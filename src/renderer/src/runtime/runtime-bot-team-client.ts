import type {
  BotDraftInput,
  BotTeam,
  BotTeamCreateInput,
  BotTeamUpdateInput
} from '../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamBrief,
  BotTeamCodeSource,
  BotTeamMessage,
  BotTeamProject,
  BotTeamTask
} from '../../../shared/rpc-contract/bot-team-room-params'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { callRuntimeRpc } from './runtime-rpc-client'
import { RuntimeRpcCallError } from './runtime-rpc-result'

// Teams live on one host; see `resolveBotTeamHost` for which.
function call<TResult>(method: string, params?: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
}

// A host from before code sources or briefs sends projects without them: not connected, empty.
function withProjectDefaults(project: BotTeamProject): BotTeamProject {
  return {
    ...project,
    codeSource: project.codeSource ?? null,
    brief: project.brief ?? { requirements: [], constraints: [], decisions: [] },
    briefUpdatedAt: project.briefUpdatedAt ?? null
  }
}

export async function listBotTeamRoom(
  teamId: string
): Promise<{ tasks: BotTeamTask[]; messages: BotTeamMessage[]; projects?: BotTeamProject[] }> {
  const room = await call<{
    tasks: BotTeamTask[]
    messages: BotTeamMessage[]
    projects?: BotTeamProject[]
  }>('botTeams.listRoom', { teamId })
  return room.projects ? { ...room, projects: room.projects.map(withProjectDefaults) } : room
}

export async function createBotTeamProject(input: {
  teamId: string
  name: string
  goal: string
  codeSource: BotTeamCodeSource | null
}): Promise<BotTeamProject> {
  return withProjectDefaults(
    (await call<{ project: BotTeamProject }>('botTeams.createProject', input)).project
  )
}

/** A host from before code sources lacks the method: the answer is 'unavailable', not a failure. */
export async function setBotTeamProjectCodeSource(
  projectId: string,
  codeSource: BotTeamCodeSource
): Promise<BotTeamProject | 'unavailable'> {
  try {
    return withProjectDefaults(
      (
        await call<{ project: BotTeamProject }>('botTeams.setProjectCodeSource', {
          projectId,
          codeSource
        })
      ).project
    )
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}

export async function setBotTeamTaskProject(
  taskId: string,
  projectId: string | null
): Promise<BotTeamTask> {
  return (await call<{ task: BotTeamTask }>('botTeams.setTaskProject', { taskId, projectId })).task
}

export function postBotTeamRequest(input: {
  teamId: string
  text: string
  start: boolean
}): Promise<{ task: BotTeamTask | null; startError: string | null }> {
  return call('botTeams.postMessage', input)
}

export async function startBotTeamTask(taskId: string): Promise<BotTeamTask> {
  return (await call<{ task: BotTeamTask }>('botTeams.startTask', { taskId })).task
}

export async function listBotTeams(): Promise<BotTeam[]> {
  return (await call<{ teams: BotTeam[] }>('botTeams.list')).teams
}

export async function createBotTeam(input: BotTeamCreateInput): Promise<BotTeam> {
  return (await call<{ team: BotTeam }>('botTeams.create', input)).team
}

export async function updateBotTeam(input: BotTeamUpdateInput): Promise<BotTeam> {
  return (await call<{ team: BotTeam }>('botTeams.update', input)).team
}

export async function deleteBotTeam(teamId: string): Promise<void> {
  await call('botTeams.delete', { teamId })
}

export async function addBotToTeam(teamId: string, bot: BotDraftInput): Promise<BotTeam> {
  return (await call<{ team: BotTeam }>('botTeams.addBot', { teamId, bot })).team
}

export async function updateBotOnTeam(
  teamId: string,
  botId: string,
  bot: BotDraftInput
): Promise<BotTeam> {
  return (await call<{ team: BotTeam }>('botTeams.updateBot', { teamId, botId, bot })).team
}

export async function removeBotFromTeam(teamId: string, botId: string): Promise<BotTeam> {
  return (await call<{ team: BotTeam }>('botTeams.removeBot', { teamId, botId })).team
}

/** Keeps what the person wrote in a project's Brief; 'unavailable' on a host from before briefs. */
export async function setBotTeamProjectBrief(
  projectId: string,
  input: { goal: string; brief: BotTeamBrief }
): Promise<BotTeamProject | 'unavailable'> {
  try {
    return withProjectDefaults(
      (await call<{ project: BotTeamProject }>('botTeams.setProjectBrief', { projectId, ...input }))
        .project
    )
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}
