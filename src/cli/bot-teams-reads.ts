import type { HandlerContext } from './dispatch'
import type { RuntimeRpcSuccess } from './runtime-client'
import type { BotTeam } from '../shared/rpc-contract/bot-team-params'
import type {
  BotTeamMessage,
  BotTeamProject,
  BotTeamTask
} from '../shared/rpc-contract/bot-team-room-params'
import type { BotTeamRoutine } from '../shared/rpc-contract/bot-team-routine-params'

/** The parts of `botTeams.listRoom` the CLI reads. */
export type BotTeamRoomData = {
  tasks: BotTeamTask[]
  messages: BotTeamMessage[]
  projects: BotTeamProject[]
}

export async function readBotTeams(ctx: HandlerContext): Promise<BotTeam[]> {
  return (await ctx.client.call<{ teams: BotTeam[] }>('botTeams.list')).result.teams
}

export function readBotTeamRoom(
  ctx: HandlerContext,
  teamId: string
): Promise<RuntimeRpcSuccess<BotTeamRoomData>> {
  return ctx.client.call<BotTeamRoomData>('botTeams.listRoom', { teamId })
}

export async function readBotTeamRoutines(
  ctx: HandlerContext,
  teamId: string
): Promise<BotTeamRoutine[]> {
  const response = await ctx.client.call<{ routines: BotTeamRoutine[] }>('botTeams.listRoutines', {
    teamId
  })
  return response.result.routines
}
