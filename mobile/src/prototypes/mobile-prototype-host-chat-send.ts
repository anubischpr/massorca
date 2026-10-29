// Sends a message to a structured chat through the host, for a chat this screen is not showing:
// the way desktop sends to the chat a set came from. The runtime fence a send names comes from the
// newest page of the chat's history, so no stream has to be open.
import type { AgentSessionHistoryResult } from '../../../src/shared/agent-session-wire'
import {
  callAgentSession,
  STRUCTURED_SEND_TIMEOUT_MS
} from '../session/mobile-structured-agent-session-rpc'
import { sendMobileStructuredAgentSessionMessage } from '../session/mobile-structured-agent-session-send'
import type { RpcClient } from '../transport/rpc-client'

type HostClient = RpcClient

async function readRuntimeFence(client: HostClient, sessionId: string): Promise<number | null> {
  const history = await callAgentSession<AgentSessionHistoryResult>(
    client,
    'agentSession.history',
    { sessionId, direction: 'tail', limit: 1 },
    STRUCTURED_SEND_TIMEOUT_MS
  )
  // The page's fence first, as the desktop send reads it; a reset's own fence only when its page has none.
  return history.page.fence ?? (history.ok ? null : (history.fence ?? null))
}

/**
 * True only when the host took the message. A host that cannot name the chat's fence, a refusal, a
 * lost answer and a transport failure are all "not sent": the caller keeps its draft.
 */
export async function sendToStructuredSessionOnHost(
  client: HostClient,
  sessionId: string,
  text: string
): Promise<boolean> {
  try {
    const fence = await readRuntimeFence(client, sessionId)
    if (fence === null) {
      return false
    }
    const outcome = await sendMobileStructuredAgentSessionMessage({
      client,
      sessionId,
      expectedRuntimeFence: fence,
      text,
      attachments: [],
      onError: () => undefined
    })
    return outcome === 'accepted' || outcome === 'queued'
  } catch {
    return false
  }
}
