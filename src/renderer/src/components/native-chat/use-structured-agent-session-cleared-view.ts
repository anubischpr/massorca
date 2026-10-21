import { useMemo } from 'react'
import { structuredAgentLabel } from '@/lib/structured-agent-session-launch-label'
import type { AgentType } from '../../../../shared/agent-status-types'
import { withNativeChatCutTurnNotices } from '../../../../shared/native-chat-cut-turn-notice'
import { agentSessionTranscriptSinceClear } from '../../../../shared/agent-session-context-clear'
import type {
  AgentJournalRenderItem,
  AgentJournalSubmission
} from '../../../../shared/agent-session-journal-types'
import {
  setNativeChatEarlierContextShown,
  useNativeChatEarlierContextShown
} from './native-chat-earlier-context-store'
import {
  useNativeChatCommandResultRows,
  withNativeChatCommandResultRows
} from './native-chat-command-result-rows'

export type NativeChatEarlierContext = {
  /** What came before the newest /clear is on screen. */
  shown: boolean
  toggle: () => void
}

/** After a /clear the chat draws from the clear onward; the earlier conversation is one click away. */
export function useStructuredAgentSessionClearedView(
  sessionId: string,
  agent: AgentType,
  journalItems: readonly AgentJournalRenderItem[],
  submissions: readonly AgentJournalSubmission[]
): {
  items: readonly AgentJournalRenderItem[]
  submissions: readonly AgentJournalSubmission[]
  earlierContext: NativeChatEarlierContext | null
} {
  const shown = useNativeChatEarlierContextShown(sessionId)
  const commandResults = useNativeChatCommandResultRows(sessionId)
  // The journal plus the one notice a cut turn with no row gets, and the results of commands the chat answered.
  const items = useMemo(
    () =>
      withNativeChatCommandResultRows(
        withNativeChatCutTurnNotices(journalItems, { agentName: structuredAgentLabel(agent) }),
        commandResults
      ),
    [agent, commandResults, journalItems]
  )
  return useMemo(() => {
    const since = agentSessionTranscriptSinceClear(items, submissions)
    if (since.boundary === 0) {
      return { items, submissions, earlierContext: null }
    }
    const earlierContext = {
      shown,
      toggle: () => setNativeChatEarlierContextShown(sessionId, !shown)
    }
    return shown
      ? { items, submissions, earlierContext }
      : { items: since.items, submissions: since.submissions, earlierContext }
  }, [items, sessionId, shown, submissions])
}
