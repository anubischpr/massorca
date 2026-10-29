import type {
  DelegationFailedPayload,
  DelegationFinishedPayload,
  DelegationStartedPayload
} from '../../../src/shared/delegated-session-journal'
import { MOBILE_AGENT_CATALOG } from '../tasks/mobile-agent-catalog'

/** The start line: the agent, its model and effort, and whether Automatic chose them. */
export function delegationStartedText(payload: DelegationStartedPayload): string {
  const details = [agentLabel(payload.agent), payload.model ?? 'default model', payload.effort]
    .filter((part): part is string => part !== null)
    .join(' · ')
  return payload.automatic
    ? `Started child session “${payload.title}” with ${details} (Automatic)`
    : `Started child session “${payload.title}” with ${details}`
}

export function delegationFailedText(payload: DelegationFailedPayload): string {
  return `Child session “${payload.title}” did not start: ${payload.reason}`
}

export function delegationFinishedHeading(payload: DelegationFinishedPayload): string {
  return payload.outcome === 'succeeded' ? 'Child session finished' : 'Child session failed'
}

/** Duration and outcome, as the finished notice's meta line words them. */
export function delegationFinishedMeta(payload: DelegationFinishedPayload): string {
  const outcome = payload.outcome === 'succeeded' ? 'succeeded' : 'failed'
  const duration = durationText(payload.durationMs)
  return duration ? `${duration} · ${outcome}` : outcome
}

/** Whole minutes as the chat words them; null when the child never reported a duration. */
export function durationText(durationMs: number | null): string | null {
  if (durationMs === null) {
    return null
  }
  const minutes = Math.floor(durationMs / 60_000)
  if (minutes < 1) {
    return 'under 1 min'
  }
  if (minutes < 60) {
    return `${minutes} min`
  }
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

function agentLabel(agent: string): string {
  return MOBILE_AGENT_CATALOG.find((entry) => entry.id === agent)?.label ?? agent
}
