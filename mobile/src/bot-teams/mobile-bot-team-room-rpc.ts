import { z } from 'zod'
import {
  BotTeamMessageSchema,
  BotTeamProjectSchema,
  BotTeamTaskSchema,
  type BotTeamCodeSource,
  type BotTeamProject,
  type BotTeamProjectInput
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'

type HostClient = Pick<RpcClient, 'sendRequest'>

const READ_TIMEOUT_MS = 15_000
const CHANGE_TIMEOUT_MS = 15_000
// Starting a bot creates its session, which takes longer than a read.
const START_TIMEOUT_MS = 60_000

const RoomReply = z.object({
  tasks: z.array(BotTeamTaskSchema),
  messages: z.array(BotTeamMessageSchema),
  // The default reads a host from before projects existed.
  projects: z.array(BotTeamProjectSchema).default([]),
  workspaceId: z.string().nullable()
})
const PostReply = z.object({
  task: BotTeamTaskSchema.nullable(),
  startError: z.string().nullable()
})
const ProjectReply = z.object({ project: BotTeamProjectSchema })

export type MobileBotTeamRoomData = z.output<typeof RoomReply>

/** A project change: the saved project, or why it was not saved. */
export type MobileBotTeamProjectResult =
  | { kind: 'ok'; project: BotTeamProject }
  /** A host older than this change: the screen says so rather than failing. */
  | { kind: 'unsupported' }
  | { kind: 'failed' }

export async function listMobileBotTeamRoom(
  client: HostClient,
  teamId: string
): Promise<MobileBotTeamRoomData | null> {
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

async function changeProject(
  client: HostClient,
  method: string,
  params: unknown
): Promise<MobileBotTeamProjectResult> {
  try {
    const response = await client.sendRequest(method, params, { timeoutMs: CHANGE_TIMEOUT_MS })
    if (!response.ok) {
      return isMobileMethodUnavailableError(response.error.code, response.error.message)
        ? { kind: 'unsupported' }
        : { kind: 'failed' }
    }
    const parsed = ProjectReply.safeParse(response.result)
    return parsed.success ? { kind: 'ok', project: parsed.data.project } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

export function createMobileBotProject(client: HostClient, input: BotTeamProjectInput) {
  return changeProject(client, 'botTeams.createProject', input)
}

export function setMobileBotProjectCodeSource(
  client: HostClient,
  projectId: string,
  codeSource: BotTeamCodeSource
) {
  return changeProject(client, 'botTeams.setProjectCodeSource', { projectId, codeSource })
}
