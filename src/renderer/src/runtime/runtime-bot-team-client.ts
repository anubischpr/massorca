import type {
  BotDraftInput,
  BotTeam,
  BotTeamCreateInput,
  BotTeamUpdateInput
} from '../../../shared/rpc-contract/bot-team-params'
import type {
  BotTeamMessage,
  BotTeamProject,
  BotTeamTask
} from '../../../shared/rpc-contract/bot-team-room-params'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { callRuntimeRpc } from './runtime-rpc-client'

// Teams live on one host; see `resolveBotTeamHost` for which.
function call<TResult>(method: string, params?: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
}

export function listBotTeamRoom(
  teamId: string
): Promise<{ tasks: BotTeamTask[]; messages: BotTeamMessage[]; projects?: BotTeamProject[] }> {
  return call('botTeams.listRoom', { teamId })
}

export async function createBotTeamProject(input: {
  teamId: string
  name: string
  goal: string
}): Promise<BotTeamProject> {
  return (await call<{ project: BotTeamProject }>('botTeams.createProject', input)).project
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
