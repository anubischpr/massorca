import { z } from 'zod'
import {
  BotTeamRoutineRunSchema,
  BotTeamRoutineSchema,
  type BotTeamRoutine,
  type BotTeamRoutineInput,
  type BotTeamRoutineUpdateInput
} from '../../../src/shared/rpc-contract/bot-team-routine-params'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'

export type HostClient = Pick<RpcClient, 'sendRequest'>

const REQUEST_TIMEOUT_MS = 15_000

export type MobileHostRead<T> =
  | { kind: 'ready'; value: T }
  /** A host from before the feature: the screen says so rather than showing nothing. */
  | { kind: 'unsupported' }
  | { kind: 'failed' }

/** Asks the host and reads the reply with its schema; a reply it cannot read is a failure, never empty. */
export async function readFromHost<S extends z.ZodTypeAny>(
  client: HostClient,
  method: string,
  params: unknown,
  schema: S
): Promise<MobileHostRead<z.output<S>>> {
  try {
    const response = await client.sendRequest(method, params, { timeoutMs: REQUEST_TIMEOUT_MS })
    if (!response.ok) {
      return isMobileMethodUnavailableError(response.error.code, response.error.message)
        ? { kind: 'unsupported' }
        : { kind: 'failed' }
    }
    const parsed = schema.safeParse(response.result)
    return parsed.success ? { kind: 'ready', value: parsed.data } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

const RoutinesReply = z.object({ routines: z.array(BotTeamRoutineSchema) })
const RunsReply = z.object({ runs: z.array(BotTeamRoutineRunSchema) })
const RoutineReply = z.object({ routine: BotTeamRoutineSchema })

async function readRoutines(client: HostClient, teamId: string) {
  const read = await readFromHost(client, 'botTeams.listRoutines', { teamId }, RoutinesReply)
  return read.kind === 'ready' ? { kind: 'ready' as const, value: read.value.routines } : read
}

export const listMobileBotTeamRoutines = readRoutines

export async function listMobileBotTeamRoutineRuns(client: HostClient, routineId: string) {
  const read = await readFromHost(client, 'botTeams.listRoutineRuns', { routineId }, RunsReply)
  return read.kind === 'ready' ? { kind: 'ready' as const, value: read.value.runs } : read
}

async function changeRoutine(
  client: HostClient,
  method: string,
  params: unknown
): Promise<BotTeamRoutine | null> {
  const read = await readFromHost(client, method, params, RoutineReply)
  return read.kind === 'ready' ? read.value.routine : null
}

/** The routine the host kept, or null when it refused or could not be reached. */
export function createMobileBotTeamRoutine(client: HostClient, input: BotTeamRoutineInput) {
  return changeRoutine(client, 'botTeams.createRoutine', input)
}

/** Saves an edited routine; a finished Once routine with a new date runs again. */
export function updateMobileBotTeamRoutine(client: HostClient, input: BotTeamRoutineUpdateInput) {
  return changeRoutine(client, 'botTeams.updateRoutine', input)
}

/** True once the host deleted the routine and its runs; tasks it started stay. */
export async function deleteMobileBotTeamRoutine(
  client: HostClient,
  routineId: string
): Promise<boolean> {
  const read = await readFromHost(
    client,
    'botTeams.deleteRoutine',
    { routineId },
    z.object({ deleted: z.literal(true) })
  )
  return read.kind === 'ready'
}

export function setMobileBotTeamRoutinePaused(
  client: HostClient,
  routineId: string,
  paused: boolean
) {
  return changeRoutine(client, 'botTeams.setRoutinePaused', { routineId, paused })
}
