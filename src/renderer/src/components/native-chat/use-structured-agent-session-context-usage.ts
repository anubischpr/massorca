import { useMemo } from 'react'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { AgentSessionOptionsResult } from '../../../../shared/agent-session-wire'
import {
  selectStructuredAgentContextSummary,
  structuredAgentContextUsageOf,
  type StructuredAgentContextSummary,
  type StructuredAgentContextUsage
} from '../../../../shared/structured-agent-session-context-usage'

/** The context readings, selected from one pass over the journal: the summary, and the ring's usage derived from it. */
export function useStructuredAgentSessionContextReadings(
  journalItems: readonly AgentJournalRenderItem[],
  support: AgentSessionOptionsResult['contextUsage'],
  journalEpoch?: string | null
): {
  summary: StructuredAgentContextSummary | null
  usage: StructuredAgentContextUsage | null
} {
  const summary = useMemo(
    () =>
      selectStructuredAgentContextSummary(
        journalItems,
        support?.current,
        support?.contextFloor && (!journalEpoch || support.contextFloor.epoch === journalEpoch)
          ? support.contextFloor.sequence
          : 0
      ),
    [journalItems, support, journalEpoch]
  )
  const usage = useMemo(() => structuredAgentContextUsageOf(summary), [summary])
  return useMemo(() => ({ summary, usage }), [summary, usage])
}
