import type {
  BotTeamRoutine,
  BotTeamRoutineInput,
  BotTeamRoutineRun
} from '../../../shared/rpc-contract/bot-team-routine-params'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { callRuntimeRpc } from './runtime-rpc-client'
import { RuntimeRpcCallError } from './runtime-rpc-result'

// Same host as every other Bot teams call; see `resolveBotTeamHost` for which.
function call<TResult>(method: string, params?: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
}

/** A host from before routines lacks the methods: the answer is 'unavailable', not a failure. */
async function orUnavailable<TResult>(
  read: () => Promise<TResult>
): Promise<TResult | 'unavailable'> {
  try {
    return await read()
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}

export function listBotTeamRoutines(teamId: string): Promise<BotTeamRoutine[] | 'unavailable'> {
  return orUnavailable(
    async () =>
      (await call<{ routines: BotTeamRoutine[] }>('botTeams.listRoutines', { teamId })).routines
  )
}

export async function createBotTeamRoutine(input: BotTeamRoutineInput): Promise<BotTeamRoutine> {
  return (await call<{ routine: BotTeamRoutine }>('botTeams.createRoutine', input)).routine
}

export async function setBotTeamRoutinePaused(
  routineId: string,
  paused: boolean
): Promise<BotTeamRoutine> {
  return (
    await call<{ routine: BotTeamRoutine }>('botTeams.setRoutinePaused', { routineId, paused })
  ).routine
}

export function listBotTeamRoutineRuns(
  routineId: string
): Promise<BotTeamRoutineRun[] | 'unavailable'> {
  return orUnavailable(
    async () =>
      (await call<{ runs: BotTeamRoutineRun[] }>('botTeams.listRoutineRuns', { routineId })).runs
  )
}
