import { z } from 'zod'
import {
  BotTeamLinkableWorkspaceSchema,
  BotTeamMessageSchema,
  BotTeamProjectSchema,
  BotTeamTaskSchema,
  type BotTeamCodeSource,
  type BotTeamLinkableWorkspace,
  type BotTeamProject,
  type BotTeamProjectInput,
  type BotTeamProjectWorkspace
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
const RequestChoiceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('new-bot') }),
  z.object({ kind: z.literal('new-team') }),
  z.object({ kind: z.literal('other-team'), teamId: z.string() })
])
const PostReply = z.object({
  task: BotTeamTaskSchema.nullable(),
  startError: z.string().nullable(),
  // True when the team answered a bare greeting: nothing is routed, so nobody is asked.
  greeted: z.boolean().default(false),
  // The defaults read a host from before the request routing: nothing was decided.
  choice: RequestChoiceSchema.nullable().default(null),
  composite: z.array(z.string()).default([]),
  answered: z.boolean().default(false),
  sentTo: z.object({ teamId: z.string(), teamName: z.string() }).nullable().default(null)
})
const ProjectReply = z.object({ project: BotTeamProjectSchema })
const LinkableReply = z.object({ workspaces: z.array(BotTeamLinkableWorkspaceSchema) })

/** The Workspaces projects the team's host offers, or why it did not list them. */
export type MobileBotTeamLinkableResult =
  | { kind: 'ok'; workspaces: BotTeamLinkableWorkspace[] }
  | { kind: 'unsupported' }
  | { kind: 'failed' }

/** A workspace link change: the saved project, a host's refusal in its own words, or an older host. */
export type MobileBotTeamWorkspaceResult =
  | { kind: 'ok'; project: BotTeamProject }
  | { kind: 'refused'; message: string }
  | { kind: 'unsupported' }
  | { kind: 'failed' }

export type MobileBotTeamRoomData = z.output<typeof RoomReply>
export type MobileBotTeamPostResult = ({ ok: true } & z.output<typeof PostReply>) | { ok: false }

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
): Promise<MobileBotTeamPostResult> {
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

export async function listMobileBotLinkableWorkspaces(
  client: HostClient,
  teamId: string
): Promise<MobileBotTeamLinkableResult> {
  try {
    const response = await client.sendRequest(
      'botTeams.listLinkableWorkspaces',
      { teamId },
      { timeoutMs: READ_TIMEOUT_MS }
    )
    if (!response.ok) {
      return isMobileMethodUnavailableError(response.error.code, response.error.message)
        ? { kind: 'unsupported' }
        : { kind: 'failed' }
    }
    const parsed = LinkableReply.safeParse(response.result)
    return parsed.success ? { kind: 'ok', workspaces: parsed.data.workspaces } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

/** Links a project to a Workspaces project, or unlinks it with null. */
export async function setMobileBotProjectWorkspace(
  client: HostClient,
  projectId: string,
  workspaceKey: BotTeamProjectWorkspace['key'] | null
): Promise<MobileBotTeamWorkspaceResult> {
  try {
    const response = await client.sendRequest(
      'botTeams.setProjectWorkspace',
      { projectId, workspaceKey },
      { timeoutMs: CHANGE_TIMEOUT_MS }
    )
    if (!response.ok) {
      return isMobileMethodUnavailableError(response.error.code, response.error.message)
        ? { kind: 'unsupported' }
        : { kind: 'refused', message: response.error.message }
    }
    const parsed = ProjectReply.safeParse(response.result)
    return parsed.success ? { kind: 'ok', project: parsed.data.project } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}
