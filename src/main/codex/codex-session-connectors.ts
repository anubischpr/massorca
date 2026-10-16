import {
  readAgentSessionConnectorSnapshot,
  type AgentSessionConnectorSnapshot
} from '../../shared/agent-session-connectors'
import type { CodexAppServerConnection } from './codex-app-server-connection'

/** Read the thread's runtime state, never infer a connection from its tool catalog or auth state.
 * Older app servers can omit runtimeStatus or reject this method; both remain unknown. */
export async function readCodexSessionConnectors(
  connection: Pick<CodexAppServerConnection, 'request'>,
  threadId: string,
  timeoutMs?: number
): Promise<AgentSessionConnectorSnapshot | undefined> {
  const servers: AgentSessionConnectorSnapshot['servers'] = []
  let cursor: string | undefined
  const seen = new Set<string>()
  try {
    for (let page = 0; page < 10; page++) {
      const result = await connection.request(
        'mcpServerStatus/list',
        { threadId, limit: 100, ...(cursor ? { cursor } : {}) },
        { timeoutMs }
      )
      if (
        !result ||
        typeof result !== 'object' ||
        !('data' in result) ||
        !Array.isArray(result.data)
      ) {
        return undefined
      }
      for (const row of result.data) {
        if (!row || typeof row !== 'object') {
          return undefined
        }
        const status = row.runtimeStatus
        servers.push({
          name: row.name,
          status:
            status === 'connected' || status === 'failed' || status === 'disabled'
              ? status
              : status === 'authenticationRequired'
                ? 'needs-auth'
                : status === 'starting' || status === 'notStarted'
                  ? 'pending'
                  : 'unknown'
        })
      }
      if (!('nextCursor' in result) || result.nextCursor === null) {
        return readAgentSessionConnectorSnapshot({ observedAt: Date.now(), servers })
      }
      if (
        typeof result.nextCursor !== 'string' ||
        !result.nextCursor ||
        seen.has(result.nextCursor)
      ) {
        return undefined
      }
      cursor = result.nextCursor
      seen.add(cursor)
    }
  } catch {
    /* Unsupported and failed reads do not change the session's option availability. */
  }
  return undefined
}
