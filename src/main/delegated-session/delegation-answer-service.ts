import type { StructuredAgentSessionHostOwnedPrompts } from '../native-chat/agent-session-wire/structured-agent-session-host-owned-prompts'
import type { OrchestrationDb } from '../runtime/orchestration/db'
import type { DelegationRequestRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import {
  delegationRequestIdOfQuestionItem,
  parseDelegationOptionId,
  type DelegationChoice
} from '../../shared/delegated-session-journal'
import { DelegationLifecycle } from './delegation-lifecycle'
import type { DelegationAnswerDeps } from './delegation-launch-types'
import { routeDelegationRequest } from './delegation-options'
import { readStoredDelegationAgents } from './delegation-stored-request'

type HostOwnedAnswer = Awaited<ReturnType<StructuredAgentSessionHostOwnedPrompts['answer']>>

function gone(message: string): HostOwnedAnswer {
  return { ok: false, reason: 'promptGone', message }
}

/**
 * Resolves the answers to agent-choice cards, from the durable request alone: a card answered after
 * a host restart finds its request in the database, not in memory.
 */
export class DelegationAnswerService {
  private readonly lifecycle: DelegationLifecycle

  constructor(private readonly deps: DelegationAnswerDeps) {
    this.lifecycle = new DelegationLifecycle(deps)
  }

  /** What the wire's prompt path calls for a question the host owns. */
  readonly hostOwnedPrompts: StructuredAgentSessionHostOwnedPrompts = {
    answer: (input) => this.answer(input),
    cancel: (input) => this.cancel(input)
  }

  /** Resolves when every launch and completion this service started has settled. */
  idle(): Promise<void> {
    return this.lifecycle.idle()
  }

  /** Re-derives what a host restart left half done; see `DelegationLifecycle.reconcile`. */
  reconcile(): Promise<void> {
    return this.lifecycle.reconcile()
  }

  /** A dispatch reached a terminal state: finishes its request, if it has one. */
  onDispatchSettled(dispatchId: string): Promise<void> {
    return this.lifecycle.onDispatchSettled(dispatchId)
  }

  private findRequest(
    sessionId: string,
    itemId: string
  ): { db: OrchestrationDb; row: DelegationRequestRow } | null {
    const requestId = delegationRequestIdOfQuestionItem(itemId)
    const db = this.deps.getDb()
    const row = requestId && db ? db.getDelegationRequest(requestId) : undefined
    return db && row && row.parent_session_id === sessionId ? { db, row } : null
  }

  private async answer(input: {
    sessionId: string
    itemId: string
    optionId: string
  }): Promise<HostOwnedAnswer> {
    const found = this.findRequest(input.sessionId, input.itemId)
    if (!found) {
      return gone(`No delegation request backs item ${input.itemId}.`)
    }
    const { db, row } = found
    const choice = parseDelegationOptionId(input.optionId)
    if (!choice || !this.offers(row, choice)) {
      return {
        ok: false,
        reason: 'optionRejected',
        message: `Option ${input.optionId} is not offered by item ${input.itemId}.`
      }
    }
    const claimed = db.transitionDelegationRequest(row.id, 'pending', 'starting', {
      choice: input.optionId,
      ...this.recomputedDecision(row, choice, input.sessionId)
    })
    // A re-answer after a lost reply, or after a restart cut the first one short: same choice, same answer.
    const held = claimed ?? db.getDelegationRequest(row.id)
    if (!held || held.choice !== input.optionId || held.status === 'cancelled') {
      return gone(`Delegation request ${row.id} was already settled.`)
    }
    return { ok: true, afterCommit: () => this.lifecycle.start(row.id) }
  }

  private async cancel(input: { sessionId: string; itemId: string }): Promise<HostOwnedAnswer> {
    const found = this.findRequest(input.sessionId, input.itemId)
    if (!found) {
      return gone(`No delegation request backs item ${input.itemId}.`)
    }
    const { db, row } = found
    const cancelled = db.transitionDelegationRequest(row.id, 'pending', 'cancelled')
    // A request already cancelled, or failed before its card was answered, only lacks the journal's word.
    const settled = cancelled ?? db.getDelegationRequest(row.id)
    if (settled?.status !== 'cancelled' && settled?.status !== 'failed') {
      return gone(`Delegation request ${row.id} was already answered.`)
    }
    return { ok: true, afterCommit: () => undefined }
  }

  private offers(row: DelegationRequestRow, choice: DelegationChoice): boolean {
    if (choice.kind === 'automatic') {
      return row.decision_json !== null
    }
    return readStoredDelegationAgents(row).some((entry) => entry.agent === choice.agent)
  }

  /** Automatic is decided again at the moment of the answer, with the usage read now. */
  private recomputedDecision(
    row: DelegationRequestRow,
    choice: DelegationChoice,
    sessionId: string
  ): { decision_json?: string | null } {
    if (choice.kind !== 'automatic') {
      return {}
    }
    const route = routeDelegationRequest({
      summary: row.summary,
      writes: row.writes === 1,
      workspaceKind: row.workspace_kind,
      parentAgent: this.deps.readParent(sessionId)?.agent ?? null,
      agents: readStoredDelegationAgents(row),
      rateLimits: this.deps.readRateLimits(),
      now: this.deps.now()
    })
    return { decision_json: route.status === 'routed' ? JSON.stringify(route.decision) : null }
  }
}
