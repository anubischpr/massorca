import { z } from 'zod'
import {
  BotTeamProjectSchema,
  type BotTeamProject
} from '../../../src/shared/rpc-contract/bot-team-room-params'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'

type HostClient = Pick<RpcClient, 'sendRequest'>

const CHANGE_TIMEOUT_MS = 15_000
const ProjectReply = z.object({ project: BotTeamProjectSchema })

/** A change to a shared project: the saved project, the host's refusal in its words, or why not. */
export type MobileBotProjectChange =
  | { kind: 'ok'; project: BotTeamProject }
  | { kind: 'refused'; message: string }
  | { kind: 'unsupported' }
  | { kind: 'failed' }

/** A refusal (for example "only the owner team") reads differently from a lost connection. */
async function change(
  client: HostClient,
  method: string,
  params: unknown
): Promise<MobileBotProjectChange> {
  try {
    const response = await client.sendRequest(method, params, { timeoutMs: CHANGE_TIMEOUT_MS })
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

/** `teamId` is the team acting; `linkedTeamIds` replaces the teams besides the owner. */
export function updateMobileBotProject(
  client: HostClient,
  input: {
    projectId: string
    teamId: string
    name?: string
    goal?: string
    linkedTeamIds?: string[]
  }
) {
  return change(client, 'botTeams.updateProject', input)
}

export function archiveMobileBotProject(
  client: HostClient,
  input: { projectId: string; teamId: string; archived: boolean }
) {
  return change(client, 'botTeams.archiveProject', input)
}

export async function deleteMobileBotProject(
  client: HostClient,
  input: { projectId: string; teamId: string }
): Promise<{ kind: 'deleted' } | Exclude<MobileBotProjectChange, { kind: 'ok' }>> {
  try {
    const response = await client.sendRequest('botTeams.deleteProject', input, {
      timeoutMs: CHANGE_TIMEOUT_MS
    })
    if (response.ok) {
      return { kind: 'deleted' }
    }
    return isMobileMethodUnavailableError(response.error.code, response.error.message)
      ? { kind: 'unsupported' }
      : { kind: 'refused', message: response.error.message }
  } catch {
    return { kind: 'failed' }
  }
}
