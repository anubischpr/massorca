/**
 * The child sessions a parent chat has started, read from its journal: one row per request, folded
 * from the start, failure and finish notices the host writes. Pure, so every client derives the same list.
 */

import type { AgentJournalItemBody } from './agent-session-journal-types'
import type { DelegationNoticePayload } from './delegated-session-journal'

export type DelegatedChildStatus = 'working' | 'succeeded' | 'failed' | 'not-started'

export type DelegatedChild = {
  requestId: string
  title: string
  status: DelegatedChildStatus
  /** Null for a request that never started. */
  agent: string | null
  model: string | null
  effort: string | null
  automatic: boolean
  /** Null for a request that never started. */
  childSessionId: string | null
  /** The execution host's clock when its start notice was observed; null without one. */
  startedAt: number | null
  resultSummary: string | null
  durationMs: number | null
  reason: string | null
}

/** The only parts of a journal row the children read. */
export type DelegatedChildJournalItem = { body: AgentJournalItemBody; observedAt: number }

/** The children a journal holds, in the order their requests first appear. */
export function delegatedChildrenFromJournal(
  items: readonly DelegatedChildJournalItem[]
): DelegatedChild[] {
  const byRequest = new Map<string, DelegatedChild>()
  for (const item of items) {
    const { body } = item
    if (body.kind !== 'status' || body.delegation === undefined) {
      continue
    }
    const notice = body.delegation
    const current = byRequest.get(notice.requestId) ?? emptyChild(notice)
    byRequest.set(notice.requestId, foldNotice(current, notice, item.observedAt))
  }
  return [...byRequest.values()]
}

function emptyChild(notice: DelegationNoticePayload): DelegatedChild {
  return {
    requestId: notice.requestId,
    title: notice.title,
    status: 'not-started',
    agent: null,
    model: null,
    effort: null,
    automatic: false,
    childSessionId: null,
    startedAt: null,
    resultSummary: null,
    durationMs: null,
    reason: null
  }
}

function foldNotice(
  child: DelegatedChild,
  notice: DelegationNoticePayload,
  observedAt: number
): DelegatedChild {
  switch (notice.status) {
    case 'started':
      return {
        ...child,
        title: notice.title,
        status: 'working',
        agent: notice.agent,
        model: notice.model,
        effort: notice.effort,
        automatic: notice.automatic,
        childSessionId: notice.childSessionId,
        startedAt: observedAt
      }
    case 'finished':
      return {
        ...child,
        title: notice.title,
        status: notice.outcome === 'succeeded' ? 'succeeded' : 'failed',
        // Why: a finish may carry no session id; the start's id still names the child.
        childSessionId: notice.childSessionId ?? child.childSessionId,
        resultSummary: notice.resultSummary,
        durationMs: notice.durationMs
      }
    case 'failed':
      return { ...child, title: notice.title, status: 'not-started', reason: notice.reason }
  }
}
