import { useSyncExternalStore } from 'react'
import { agentJournalItemKey } from '../../../../shared/agent-session-journal-item-key'
import {
  AGENT_JOURNAL_THREAD_SCOPE,
  type AgentJournalRenderItem
} from '../../../../shared/agent-session-journal-types'
import { AGENT_SESSION_COMMAND_RESULT_PRESENTATION } from '../../../../shared/native-chat-command-result'
import { hostStatesTurnScopes } from '../../../../shared/native-chat-turn-membership'

// What a command the chat answered itself printed (`/status`). Held for this app session only: the
// host never records it, so it is not in the journal and does not survive a reload.
export type NativeChatCommandResultRow = {
  id: number
  text: string
  observedAt: number
}

const NO_ROWS: readonly NativeChatCommandResultRow[] = []
const rowsBySession = new Map<string, readonly NativeChatCommandResultRow[]>()
const listeners = new Set<() => void>()
let lastId = 0

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function appendNativeChatCommandResultRow(sessionId: string, text: string): void {
  lastId += 1
  const row: NativeChatCommandResultRow = { id: lastId, text, observedAt: Date.now() }
  rowsBySession.set(sessionId, [...(rowsBySession.get(sessionId) ?? NO_ROWS), row])
  for (const listener of listeners) {
    listener()
  }
}

export function useNativeChatCommandResultRows(
  sessionId: string
): readonly NativeChatCommandResultRow[] {
  return useSyncExternalStore(subscribe, () => rowsBySession.get(sessionId) ?? NO_ROWS)
}

/** A status row's text: one `label: value` line per fact. */
export function nativeChatStatusRowText(
  facts: readonly { label: string; value: string }[]
): string {
  return facts.map(({ label, value }) => `${label}: ${value}`).join('\n')
}

/** The journal with each command result appended after its last row, as a row no host wrote. */
export function withNativeChatCommandResultRows(
  items: readonly AgentJournalRenderItem[],
  rows: readonly NativeChatCommandResultRow[]
): readonly AgentJournalRenderItem[] {
  if (rows.length === 0) {
    return items
  }
  const last = items.at(-1)
  const sequence = last?.sequence ?? 0
  const sequenceIndex = last?.sequenceIndex ?? 0
  // A journal that states turn scopes places a row without one among the turns, so it states the thread.
  const scoped = hostStatesTurnScopes(items)
  const notices = rows.map((row, index): AgentJournalRenderItem => ({
    itemId: agentJournalItemKey({
      provider: 'orca',
      clientMessageId: `command-result:${row.id}`
    }),
    revision: 0,
    body: {
      kind: 'status',
      text: row.text,
      tone: 'notice',
      presentation: AGENT_SESSION_COMMAND_RESULT_PRESENTATION
    },
    sequence,
    sequenceIndex: sequenceIndex + (index + 1) * 0.5,
    observedAt: row.observedAt,
    ...(scoped ? { turnScope: AGENT_JOURNAL_THREAD_SCOPE } : {})
  }))
  return [...items, ...notices]
}
