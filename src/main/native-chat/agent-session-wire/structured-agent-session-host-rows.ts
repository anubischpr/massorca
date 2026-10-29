// Rows the host writes into a chat on its own behalf, outside any turn or client operation: the
// agent-choice card and the notices of a delegated session. The journal's commit publishes them.

import {
  AGENT_JOURNAL_THREAD_SCOPE,
  type AgentJournalItemBody,
  type AgentJournalItemIdentity
} from '../../../shared/agent-session-journal-types'
import type { JournalAppendResult } from '../agent-session-journal/journal-store-contracts'
import type { StructuredAgentSessionHost } from './structured-agent-session-host'
import { structuredAgentSessionConversationFence } from './structured-agent-session-provider-child'

export type StructuredAgentSessionHostRows = {
  /** Appends or revises one row by identity. Throws when this host holds no such chat. */
  appendHostRow: (
    sessionId: string,
    identity: AgentJournalItemIdentity,
    body: AgentJournalItemBody
  ) => Promise<JournalAppendResult>
}

export function structuredAgentSessionHostRows(
  host: Pick<StructuredAgentSessionHost, 'lifetime' | 'deps'>
): StructuredAgentSessionHostRows {
  return {
    appendHostRow: async (sessionId, identity, body) => {
      const { journal } = await host.lifetime.conversation(sessionId)
      return journal.appendItem(identity, body, {
        // Where the next child starts: the fence every conversation write carries.
        fence: structuredAgentSessionConversationFence(host.deps.store, sessionId),
        turnScope: AGENT_JOURNAL_THREAD_SCOPE
      })
    }
  }
}
