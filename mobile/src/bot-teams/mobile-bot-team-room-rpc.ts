import { z } from 'zod'
import {
  BotTeamMessageSchema,
  BotTeamTaskSchema
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import type { RpcClient } from '../transport/rpc-client'

type HostClient = Pick<RpcClient, 'sendRequest'>

const READ_TIMEOUT_MS = 15_000
// Starting a bot creates its session, which takes longer than a read.
const START_TIMEOUT_MS = 60_000

const RoomReply = z.object({
  tasks: z.array(BotTeamTaskSchema),
  messages: z.array(BotTeamMessageSchema),
  workspaceId: z.string().nullable()
})
const PostReply = z.object({
  task: BotTeamTaskSchema.nullable(),
  startError: z.string().nullable()
})

export async function listMobileBotTeamRoom(client: HostClient, teamId: string) {
  try {
    const response = await client.sendRequest(
      'botTeams.listRoom',
      { teamId },
      { timeoutMs: READ_TIMEOUT_MS }
    )
    if (!response.ok) {
      return null
    }
    const parsed = RoomReply.safeParse(response.result)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function postMobileBotTeamRequest(
  client: HostClient,
  input: { teamId: string; text: string; start: boolean }
): Promise<
  | { ok: true; task: z.output<typeof BotTeamTaskSchema> | null; startError: string | null }
  | { ok: false }
> {
  try {
    const response = await client.sendRequest('botTeams.postMessage', input, {
      timeoutMs: START_TIMEOUT_MS
    })
    if (!response.ok) {
      return { ok: false }
    }
    const parsed = PostReply.safeParse(response.result)
    return parsed.success ? { ok: true, ...parsed.data } : { ok: false }
  } catch {
    return { ok: false }
  }
}

/** The reason the task did not start, or null when it did. */
export async function startMobileBotTeamTask(
  client: HostClient,
  taskId: string
): Promise<string | null> {
  try {
    const response = await client.sendRequest(
      'botTeams.startTask',
      { taskId },
      { timeoutMs: START_TIMEOUT_MS }
    )
    return response.ok ? null : response.error.message
  } catch {
    return 'This host could not be reached.'
  }
}
