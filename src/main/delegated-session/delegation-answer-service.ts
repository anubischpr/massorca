import type { StructuredAgentSessionHostOwnedPrompts } from '../native-chat/agent-session-wire/structured-agent-session-host-owned-prompts'
import type { OrchestrationDb } from '../runtime/orchestration/db'
import type { DelegationRequestRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import {
  delegationRequestIdOfQuestionItem,
  parseDelegationOptionId,
  type DelegationChoice,
  delegationAgentOptionId
} from '../../shared/delegated-session-journal'
import { DelegationLifecycle } from './delegation-lifecycle'
import type { DelegationAnswerDeps } from './delegation-launch-types'
import { routeDelegationRequest } from './delegation-options'
import {
  readStoredAdvisedTier,
  readStoredDelegationAgents,
  storedOptionsWithPrototypeAnswers
} from './delegation-stored-request'
import type { PrototypeDesignSystemMode } from '../../shared/prototype-design-system-files'
import { waitForDelegationUsageRefresh } from './delegation-usage-refresh'

type HostOwnedAnswer = Awaited<ReturnType<StructuredAgentSessionHostOwnedPrompts['answer']>>

function gone(message: string): HostOwnedAnswer {
  return { ok: false, reason: 'promptGone', message }
}

/**
 * Resolves the answers to agent-choice cards, from the durable request alone: a card answered after
 * a host restart finds its request in the database, not in memory.
 */
// Why a message and not a notice: the agent reads no notice, and it ended its turn waiting for this answer.
function delegationDeclinedMessage(title: string): string {
  return `The user cancelled the child session "${title}". No child was started and no worktree was created. Do not request it again unless the user asks.`
}

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

  /** Starts a request filed with its agent already decided; there is no card to answer. */
  startChosenAgent(requestId: string, agent: string): void {
    const db = this.deps.getDb()
    const row = db?.getDelegationRequest(requestId)
    const choice = { kind: 'agent' as const, agent }
    if (!db || !row || !this.offers(row, choice)) {
      throw new Error(`Delegation request ${requestId} cannot start ${agent}.`)
    }
    const claimed = db.transitionDelegationRequest(row.id, 'pending', 'starting', {
      choice: delegationAgentOptionId(agent),
      ...this.recomputedDecision(row, choice, row.parent_session_id)
    })
    if (!claimed) {
      throw new Error(`Delegation request ${requestId} was already settled.`)
    }
    this.lifecycle.start(row.id)
  }

  private async answer(input: {
    sessionId: string
    itemId: string
    optionId: string
    /** The prototype count the card's answer carried; absent keeps the Settings count. */
    count?: number
    /** The design system choice the card's answer carried; absent keeps a child's default of using it. */
    designSystem?: PrototypeDesignSystemMode
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
    if (choice.kind === 'automatic') {
      await waitForDelegationUsageRefresh(this.deps.refreshUsage)
    }
    const claimed = db.transitionDelegationRequest(row.id, 'pending', 'starting', {
      choice: input.optionId,
      ...this.recomputedDecision(row, choice, input.sessionId),
      ...(input.count === undefined && input.designSystem === undefined
        ? {}
        : {
            options_json: storedOptionsWithPrototypeAnswers(row, {
              ...(input.count === undefined ? {} : { count: input.count }),
              ...(input.designSystem === undefined ? {} : { designSystem: input.designSystem })
            })
          })
    })
    // A re-answer after a lost reply, or after a restart cut the first one short: same choice, same answer.
    const held = claimed ?? db.getDelegationRequest(row.id)
    if (!held || held.choice !== input.optionId || held.status === 'cancelled') {
      return gone(`Delegation request ${row.id} was already settled.`)
    }
    return {
      ok: true,
      afterCommit: () => this.lifecycle.start(row.id),
      // Only the answer that took the claim hands it back; a repeat of the same choice holds nothing.
      ...(claimed
        ? {
            rollback: () => {
              db.transitionDelegationRequest(row.id, 'starting', 'pending', {
                choice: null,
                decision_json: row.decision_json,
                options_json: row.options_json
              })
            }
          }
        : {})
    }
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
    return {
      ok: true,
      afterCommit: () => {
        if (cancelled) {
          this.deps.tellParent(row.parent_session_id, delegationDeclinedMessage(row.title))
        }
      },
      ...(cancelled
        ? {
            rollback: () => {
              db.transitionDelegationRequest(row.id, 'cancelled', 'pending')
            }
          }
        : {})
    }
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
      now: this.deps.now(),
      ...readStoredAdvisedTier(row)
    })
    return { decision_json: route.status === 'routed' ? JSON.stringify(route.decision) : null }
  }
}
