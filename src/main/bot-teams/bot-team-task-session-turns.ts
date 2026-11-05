import { randomUUID } from 'node:crypto'
import { createStructuredAgentSessionOperationId } from '../../shared/structured-agent-session-mutation'
import { structuredAgentSessionSendBody } from '../../shared/structured-agent-session-send-mutation'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import { sendAgentTurn } from '../runtime/orchestration/send-agent-turn'
import { lastAssistantReplyOf } from './bot-team-task-question'

/** The text of the bot's last reply in its task session; null when this host does not hold the session. */
export async function readBotTeamSessionReply(sessionId: string): Promise<string | null> {
  try {
    const snapshot = await getStructuredAgentSessionHost()?.journalSnapshot(sessionId)
    return snapshot ? lastAssistantReplyOf(snapshot.items) : null
  } catch {
    return null
  }
}

/**
 * Sends the person's answer to a task's session as its next turn, the way a message typed in that
 * chat goes: a busy chat holds it and sends it when the turn ends. False when the session did not take it.
 */
export async function sendBotTeamTaskFollowUp(sessionId: string, text: string): Promise<boolean> {
  const host = getStructuredAgentSessionHost()
  if (!host) {
    return false
  }
  try {
    // Opens a conversation the idle sweep closed; that starts no agent.
    await host.journalSnapshot(sessionId)
    const fence = host.deps.store.getRecord(sessionId)?.lease.runtimeFence
    if (fence === undefined) {
      return false
    }
    const outcome = await sendAgentTurn({
      kind: 'structured-session',
      host,
      sessionId,
      callerKey: `trusted-local:bot-team:answer:${sessionId}`,
      turn: {
        body: structuredAgentSessionSendBody(text, []),
        operationId: createStructuredAgentSessionOperationId(randomUUID),
        expectedRuntimeFence: fence,
        delivery: 'queue'
      }
    })
    switch (outcome.kind) {
      case 'refused':
        return false
      case 'queued':
        return true
      case 'sent':
        return outcome.submission?.dispatchState !== 'rejected'
    }
  } catch (error) {
    console.warn('[bot-teams] could not send the answer to the bot’s session', error)
    return false
  }
}
