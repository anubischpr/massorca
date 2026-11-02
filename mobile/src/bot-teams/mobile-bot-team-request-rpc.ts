import { z } from 'zod'
import {
  BotTeamTaskSchema,
  type BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { RpcClient } from '../transport/rpc-client'

type HostClient = Pick<RpcClient, 'sendRequest'>

// Filing or handing over a task starts a bot, which takes longer than a read.
const START_TIMEOUT_MS = 60_000
const FiledReply = z.object({ task: BotTeamTaskSchema, startError: z.string().nullable() })

/** The task the host filed, and why it did not start; `ok: false` when nothing was filed. */
export type MobileBotTeamFiling =
  | { ok: true; task: BotTeamTask; startError: string | null }
  | { ok: false }

async function fileWith(
  client: HostClient,
  method: string,
  params: unknown
): Promise<MobileBotTeamFiling> {
  try {
    const response = await client.sendRequest(method, params, { timeoutMs: START_TIMEOUT_MS })
    if (!response.ok) {
      return { ok: false }
    }
    const parsed = FiledReply.safeParse(response.result)
    return parsed.success ? { ok: true, ...parsed.data } : { ok: false }
  } catch {
    return { ok: false }
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
