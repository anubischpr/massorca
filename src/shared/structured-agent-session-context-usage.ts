// The context window a structured session reads from its own journal's turn
// rows. Facts are written only to the open or newest turn and each write
// replaces its namesake, so the newest row carrying a part holds its current
// value. Nothing is held outside the journal, so a restart replays the same answer.

import {
  contextTokensFromUsage,
  type AgentSessionContextUsage,
  type AgentSessionContextUsageCategory,
  type AgentSessionContextUsed,
  type AgentSessionContextWindow
} from './agent-session-context-usage'
import type { AgentJournalRenderItem } from './agent-session-journal-types'
import { readAgentJournalTurn } from './agent-session-turn-record'
import {
  isAgentSessionContextClear,
  latestAgentSessionContextClearSequence
} from './agent-session-context-clear'

export type StructuredAgentContextUsage = {
  usedTokens: number
  windowTokens: number
  /** Rounded and unclamped, so an over-limit session reads above 100. */
  percentage: number
  /** True when the count comes from the last response rather than a report. */
  estimated: boolean
  /** The provider's breakdown; empty for an estimate. */
  categories: readonly AgentSessionContextUsageCategory[]
}

/** What a summary surface reads. The tokens can be known while the window is not, and then so is no percentage. */
export type StructuredAgentContextSummary = {
  usedTokens: number
  /** Null when the serving model's window is not known. */
  windowTokens: number | null
  /** Rounded and unclamped; null without a window, since a percentage needs one. */
  percentage: number | null
  /** True when the count comes from the last response rather than a report. */
  estimated: boolean
  /** The provider's breakdown; empty for an estimate. */
  categories: readonly AgentSessionContextUsageCategory[]
  /** When the usage was captured, as the journal recorded it. */
  observedAt: number
}

type ContextFactSource = Pick<AgentJournalRenderItem, 'sequence' | 'body'>

/** The newest of each part these rows carry, in any order; a part none of them carries is absent. */
export function latestStructuredAgentContextFacts(
  items: Iterable<ContextFactSource>,
  minimumSequence = 0
): AgentSessionContextUsage {
  let used: { sequence: number; fact: AgentSessionContextUsed } | null = null
  let window: { sequence: number; fact: AgentSessionContextWindow } | null = null
  for (const item of items) {
    if (isAgentSessionContextClear(item.body) && item.sequence > minimumSequence) {
      minimumSequence = item.sequence
      if (used && used.sequence <= minimumSequence) {
        used = null
      }
      if (window && window.sequence <= minimumSequence) {
        window = null
      }
    }
    if (item.sequence <= minimumSequence) {
      continue
    }
    const facts = readAgentJournalTurn(item.body)?.contextUsage
    if (facts?.used && (used === null || item.sequence >= used.sequence)) {
      used = { sequence: item.sequence, fact: facts.used }
    }
    if (facts?.window && (window === null || item.sequence >= window.sequence)) {
      window = { sequence: item.sequence, fact: facts.window }
    }
  }
  return { ...(used ? { used: used.fact } : {}), ...(window ? { window: window.fact } : {}) }
}

/**
 * The summary reading of the loaded rows, with `wholeJournal` (the host's answer
 * over every row) filling any part they lack. The loaded window reaches the live
 * head, so a part found in it is newer than the host's; the host's covers only
 * rows older than the window.
 */
export function selectStructuredAgentContextSummary(
  items: readonly AgentJournalRenderItem[],
  wholeJournal?: AgentSessionContextUsage,
  minimumSequence = 0
): StructuredAgentContextSummary | null {
  const clearedSequence = latestAgentSessionContextClearSequence(items)
  const loaded = latestStructuredAgentContextFacts(
    items,
    Math.max(minimumSequence, clearedSequence)
  )
  const fallback = clearedSequence > minimumSequence ? undefined : wholeJournal
  return summarizeStructuredAgentContextFacts({ ...fallback, ...loaded })
}

/** The ring's reading: null unless the window is known, so no percentage is ever invented. */
export function selectStructuredAgentContextUsage(
  items: readonly AgentJournalRenderItem[],
  wholeJournal?: AgentSessionContextUsage,
  minimumSequence = 0
): StructuredAgentContextUsage | null {
  return structuredAgentContextUsageOf(
    selectStructuredAgentContextSummary(items, wholeJournal, minimumSequence)
  )
}

/** The ring's form of a summary; null when the summary has no window to measure against. */
export function structuredAgentContextUsageOf(
  summary: StructuredAgentContextSummary | null
): StructuredAgentContextUsage | null {
  if (!summary || summary.windowTokens === null || summary.percentage === null) {
    return null
  }
  return {
    usedTokens: summary.usedTokens,
    windowTokens: summary.windowTokens,
    percentage: summary.percentage,
    estimated: summary.estimated,
    categories: summary.categories
  }
}

function summarizeStructuredAgentContextFacts({
  used: fact,
  window
}: AgentSessionContextUsage): StructuredAgentContextSummary | null {
  if (fact?.kind === 'report') {
    return {
      usedTokens: fact.usedTokens,
      windowTokens: fact.windowTokens,
      percentage: fact.percentage,
      estimated: false,
      categories: fact.categories,
      observedAt: fact.capturedAt
    }
  }
  if (fact?.kind === 'snapshot') {
    return {
      usedTokens: fact.usedTokens,
      windowTokens: fact.windowTokens,
      percentage: Math.round((fact.usedTokens / fact.windowTokens) * 100),
      estimated: false,
      categories: [],
      observedAt: fact.capturedAt
    }
  }
  // `unknown`, or a kind a newer host writes that this client cannot measure.
  if (fact?.kind !== 'estimate') {
    return null
  }
  // The writer holds estimates back across a model change, so a window, when known, is this model's.
  const usedTokens = contextTokensFromUsage(fact.usage)
  const windowTokens = window?.tokens ?? null
  return {
    usedTokens,
    windowTokens,
    percentage: windowTokens === null ? null : Math.round((usedTokens / windowTokens) * 100),
    estimated: true,
    categories: [],
    observedAt: fact.capturedAt
  }
}
