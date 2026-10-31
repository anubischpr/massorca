import type {
  BotDraftInput,
  BotTeam,
  BotTeamCreateInput,
  BotTeamUpdateInput
} from '../../../shared/rpc-contract/bot-team-params'
import { useAppStore } from '@/store'
import { getActiveRuntimeTarget } from './runtime-client-target'
import { callRuntimeRpc } from './runtime-rpc-client'

// Teams live on the host this window is connected to, local or remote.
function call<TResult>(method: string, params?: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(
    getActiveRuntimeTarget(useAppStore.getState().settings),
    method,
    params
  )
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

export async function removeBotFromTeam(teamId: string, botId: string): Promise<BotTeam> {
  return (await call<{ team: BotTeam }>('botTeams.removeBot', { teamId, botId })).team
}
