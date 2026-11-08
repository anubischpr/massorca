import { z } from 'zod'
import type { BotTeamRequestChoice } from '../../../src/shared/bot-team-request-choice'
import { withSenderTimeZone } from '../../../src/shared/bot-team-routine-zone'
import {
  BotTeamTaskSchema,
  type BotTeamTask
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'
import { RequestChoiceSchema } from './mobile-bot-team-room-rpc'

type HostClient = Pick<RpcClient, 'sendRequest'>

// Filing or handing over a task starts a bot, which takes longer than a read.
const START_TIMEOUT_MS = 60_000
// A question the host asks first comes back with no task: nothing is filed until it is answered.
const FiledReply = z.object({
  task: BotTeamTaskSchema.nullable(),
  startError: z.string().nullable(),
  // A choice kind newer than this app reads as no choice instead of failing the whole reply.
  choice: RequestChoiceSchema.nullable().default(null).catch(null)
})

/** What the host did with a filing: the task it filed, the question it asks first, or no answer. */
export type MobileBotTeamFiling =
  /** The task, and why it did not start (null when it did). */
  | { kind: 'filed'; task: BotTeamTask; startError: string | null }
  /** The host asks a question before it files, such as the project question. */
  | { kind: 'asked'; choice: BotTeamRequestChoice }
  /** A host from before this method: the screen says so rather than blaming the connection. */
  | { kind: 'unsupported' }
  | { kind: 'failed' }

/** The person's answer for a request the room holds, filed as the desktop files it. */
export type MobileBotTeamRequestFiling = {
  teamId: string
  text: string
  /** The bot that takes it; the least busy bot of the receiving team when absent. */
  botId?: string
  toTeamId?: string
  /** The other bots a composite task has parts for. */
  alsoNeeds?: string[]
  later?: boolean
  /** Only a client that can show the project question asks it; an older host never sends one. */
  askProject?: boolean
  /** A project of the team, or null for none; absent until the question is answered. */
  projectId?: string | null
}

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
    if (!parsed.success) {
      return { kind: 'failed' }
    }
    if (parsed.data.choice !== null) {
      return { kind: 'asked', choice: parsed.data.choice }
    }
    return parsed.data.task === null
      ? { kind: 'failed' }
      : { kind: 'filed', task: parsed.data.task, startError: parsed.data.startError }
  } catch {
    return { kind: 'failed' }
  }
}

/** Files the person's answer for a request the room holds: a bot, another team, and a project. */
export function assignMobileBotTeamRequest(
  client: HostClient,
  input: MobileBotTeamRequestFiling
): Promise<MobileBotTeamFiling> {
  return fileWith(client, 'botTeams.assignRequest', withSenderTimeZone({ ...input, start: true }))
}

/** A hand-over either happens, is refused, or is unsupported: it never asks a question. */
export type MobileBotTeamHandover = Exclude<MobileBotTeamFiling, { kind: 'asked' }>

/** Gives an idle task to a bot of any team; the new owner continues from the task so far. */
export async function reassignMobileBotTeamTask(
  client: HostClient,
  input: { taskId: string; botId: string }
): Promise<MobileBotTeamHandover> {
  const filed = await fileWith(client, 'botTeams.reassignTask', input)
  // A question from the host on a hand-over reads as a refusal, not as a task to file.
  return filed.kind === 'asked' ? { kind: 'failed' } : filed
}
