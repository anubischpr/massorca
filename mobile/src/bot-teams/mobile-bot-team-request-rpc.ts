import { z } from 'zod'
import {
  BotTeamTaskSchema,
  type BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'

type HostClient = Pick<RpcClient, 'sendRequest'>

// Filing or handing over a task starts a bot, which takes longer than a read.
const START_TIMEOUT_MS = 60_000
const FiledReply = z.object({ task: BotTeamTaskSchema, startError: z.string().nullable() })

/** What the host did with a filing: the task it filed, a host too old to file this way, or no answer. */
export type MobileBotTeamFiling =
  /** The task, and why it did not start (null when it did). */
  | { kind: 'filed'; task: BotTeamTask; startError: string | null }
  /** A host from before this method: the screen says so rather than blaming the connection. */
  | { kind: 'unsupported' }
  | { kind: 'failed' }

async function fileWith(
  client: HostClient,
  method: string,
  params: unknown
): Promise<MobileBotTeamFiling> {
  try {
    const response = await client.sendRequest(method, params, { timeoutMs: START_TIMEOUT_MS })
    if (!response.ok) {
      return isMobileMethodUnavailableError(response.error.code, response.error.message)
        ? { kind: 'unsupported' }
        : { kind: 'failed' }
    }
    const parsed = FiledReply.safeParse(response.result)
    return parsed.success
      ? { kind: 'filed', task: parsed.data.task, startError: parsed.data.startError }
      : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

/** Files a request the room could not place: to one bot, to another team, or to this team's least busy bot. */
export function assignMobileBotTeamRequest(
  client: HostClient,
  input: { teamId: string; text: string; botId?: string; toTeamId?: string }
): Promise<MobileBotTeamFiling> {
  return fileWith(client, 'botTeams.assignRequest', { ...input, start: true })
}

/** Gives an idle task to a bot of any team; the new owner continues from the task so far. */
export function reassignMobileBotTeamTask(
  client: HostClient,
  input: { taskId: string; botId: string }
): Promise<MobileBotTeamFiling> {
  return fileWith(client, 'botTeams.reassignTask', { ...input, start: true })
}
