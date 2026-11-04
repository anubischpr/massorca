import {
  BotTeamSessionTeamsResult,
  type BotTeamSessionTeamsResult as SessionTeamsResult
} from '../../../src/shared/rpc-contract/bot-team-session-team-params'
import type { RpcClient } from '../transport/rpc-client'

type HostClient = Pick<RpcClient, 'sendRequest'>
type SessionTeamMap = SessionTeamsResult['sessionTeams']

const READ_TIMEOUT_MS = 15_000
// A structured session's tab id is its session id behind this prefix, so a row names its session.
const STRUCTURED_TAB_PREFIX = 'structured-agent-session-'

/** The session a row shows, read from its pane key; null for a terminal pane. */
export function sessionIdFromPaneKey(paneKey: string): string | null {
  const tabId = paneKey.slice(0, paneKey.lastIndexOf(':'))
  return tabId.startsWith(STRUCTURED_TAB_PREFIX) ? tabId.slice(STRUCTURED_TAB_PREFIX.length) : null
}

/** The bot team that started a history row's session, found through its structured owner's session id. */
export function botTeamForStructuredSession(
  sessionTeams: SessionTeamMap,
  structuredSession: { sessionId: string } | undefined
): SessionTeamMap[string] | undefined {
  return structuredSession ? sessionTeams[structuredSession.sessionId] : undefined
}

export function botTeamForPaneKey(
  sessionTeams: SessionTeamMap,
  paneKey: string
): SessionTeamMap[string] | undefined {
  const sessionId = sessionIdFromPaneKey(paneKey)
  return sessionId === null ? undefined : sessionTeams[sessionId]
}

// Why: every row on a host reads the same map, so concurrent reads share one request per host client.
const sharedReads = new WeakMap<HostClient, Promise<SessionTeamMap>>()

export function loadSharedMobileBotTeamSessionTeams(client: HostClient): Promise<SessionTeamMap> {
  let read = sharedReads.get(client)
  if (!read) {
    read = listMobileBotTeamSessionTeams(client).finally(() => {
      sharedReads.delete(client)
    })
    sharedReads.set(client, read)
  }
  return read
}

/** The host's bot-team sessions; a host from before the method has none to show. */
export async function listMobileBotTeamSessionTeams(client: HostClient): Promise<SessionTeamMap> {
  try {
    const response = await client.sendRequest('botTeams.sessionTeams', null, {
      timeoutMs: READ_TIMEOUT_MS
    })
    if (!response.ok) {
      return {}
    }
    const parsed = BotTeamSessionTeamsResult.safeParse(response.result)
    return parsed.success ? parsed.data.sessionTeams : {}
  } catch {
    return {}
  }
}
