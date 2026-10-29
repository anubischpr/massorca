import type { AgentJournalStatusItem } from '../../shared/agent-session-journal-types'
import type {
  DelegationFailedPayload,
  DelegationFinishedPayload,
  DelegationStartedPayload
} from '../../shared/delegated-session-journal'

const RESULT_SUMMARY_MAX_CHARS = 280

/** The first lines of a worker's report, flattened to one line a notice can carry. */
export function summarizeDelegationResult(result: string | null): string {
  const flat = (result ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > RESULT_SUMMARY_MAX_CHARS
    ? `${flat.slice(0, RESULT_SUMMARY_MAX_CHARS - 1)}…`
    : flat
}

export function delegationStartedNotice(
  payload: DelegationStartedPayload,
  agentLabel: string
): AgentJournalStatusItem {
  const how = [agentLabel, payload.model, payload.effort].filter(
    (part): part is string => part !== null && part.length > 0
  )
  return {
    kind: 'status',
    text: `Started child session “${payload.title}” with ${how.join(' · ')} (${
      payload.automatic ? 'Automatic' : 'Manual'
    })`,
    tone: 'notice',
    delegation: payload
  }
}

export function delegationFailedNotice(payload: DelegationFailedPayload): AgentJournalStatusItem {
  return {
    kind: 'status',
    text: `Could not start child session “${payload.title}”: ${payload.reason}`,
    tone: 'error',
    delegation: payload
  }
}

export function delegationFinishedNotice(
  payload: DelegationFinishedPayload
): AgentJournalStatusItem {
  const verdict = payload.outcome === 'succeeded' ? 'finished' : 'failed'
  return {
    kind: 'status',
    text: `Child session “${payload.title}” ${verdict}${
      payload.resultSummary.length > 0 ? `: ${payload.resultSummary}` : ''
    }`,
    tone: payload.outcome === 'succeeded' ? 'notice' : 'error',
    delegation: payload
  }
}
