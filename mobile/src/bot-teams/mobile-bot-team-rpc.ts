import { z } from 'zod'
import {
  BotTeamSchema,
  type BotDraftInput,
  type BotTeam,
  type BotTeamCreateInput,
  type BotTeamUpdateInput
} from '../../../src/shared/rpc-contract/bot-team-params'
import { isMobileMethodUnavailableError } from '../transport/mobile-method-unavailable'
import type { RpcClient } from '../transport/rpc-client'

type HostClient = Pick<RpcClient, 'sendRequest'>

const REQUEST_TIMEOUT_MS = 15_000
const ListReply = z.object({ teams: z.array(BotTeamSchema) })
const TeamReply = z.object({ team: BotTeamSchema })

export type MobileBotTeamList =
  | { kind: 'ready'; teams: BotTeam[] }
  /** A host older than Bot teams; the app stays on Workspaces. */
  | { kind: 'unsupported' }
  | { kind: 'failed' }

export async function listMobileBotTeams(client: HostClient): Promise<MobileBotTeamList> {
  try {
    const response = await client.sendRequest('botTeams.list', undefined, {
      timeoutMs: REQUEST_TIMEOUT_MS,
      budgetSpansConnect: true
    })
    if (!response.ok) {
      return isMobileMethodUnavailableError(response.error.code, response.error.message)
        ? { kind: 'unsupported' }
        : { kind: 'failed' }
    }
    const parsed = ListReply.safeParse(response.result)
    return parsed.success ? { kind: 'ready', teams: parsed.data.teams } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

/** The changed team, or null when the host refused or could not be reached. */
async function changeTeam(
  client: HostClient,
  method: string,
  params: unknown
): Promise<BotTeam | null> {
  try {
    const response = await client.sendRequest(method, params, {
      timeoutMs: REQUEST_TIMEOUT_MS
    })
    if (!response.ok) {
      return null
    }
    const parsed = TeamReply.safeParse(response.result)
    return parsed.success ? parsed.data.team : null
  } catch {
    return null
  }
}

export function createMobileBotTeam(client: HostClient, input: BotTeamCreateInput) {
  return changeTeam(client, 'botTeams.create', input)
}

export function updateMobileBotTeam(client: HostClient, input: BotTeamUpdateInput) {
  return changeTeam(client, 'botTeams.update', input)
}

export function addMobileBot(client: HostClient, teamId: string, bot: BotDraftInput) {
  return changeTeam(client, 'botTeams.addBot', { teamId, bot })
}
