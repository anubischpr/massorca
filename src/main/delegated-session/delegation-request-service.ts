import { boundJournalPromptBody } from '../native-chat/agent-session-journal/journal-prompt-body-bounds'
import { OrchestrationError } from '../runtime/orchestration/orchestration-error'
import {
  delegationQuestionItemId,
  delegationQuestionRowIdentity
} from '../../shared/delegated-session-journal'
import { buildDelegationCardContent, routeDelegationRequest } from './delegation-options'
import type { DelegationRequestDeps } from './delegation-service-types'

export type DelegationRequestInput = {
  parentSessionId: string
  summary: string
  prompt: string
  title?: string
  writes: boolean
}

export type DelegationRequestReceipt = {
  requestId: string
  status: 'awaiting_choice'
  questionItemId: string
}

const CARD_QUESTION = 'Which agent should handle this session?'
const TITLE_MAX_CHARS = 80

function titleFor(input: DelegationRequestInput): string {
  const given = input.title?.trim()
  const base = given && given.length > 0 ? given : input.summary.trim()
  return base.length > TITLE_MAX_CHARS ? `${base.slice(0, TITLE_MAX_CHARS - 1)}…` : base
}

/** Files delegated-session requests and posts their agent-choice cards to the parent chat. */
export class DelegationRequestService {
  constructor(private readonly deps: DelegationRequestDeps) {}

  /** Files a request and posts its card to the parent chat; returns without waiting for a choice. */
  async request(input: DelegationRequestInput): Promise<DelegationRequestReceipt> {
    const parent = this.deps.readParent(input.parentSessionId)
    if (!parent) {
      throw new OrchestrationError(
        'delegation_parent_unavailable',
        `Chat ${input.parentSessionId} is not held by this host, so it cannot start a child session. No effects were applied.`,
        { effectsApplied: false }
      )
    }
    const agents = await this.deps.listAgents(parent)
    if (agents.length === 0) {
      throw new OrchestrationError(
        'delegation_no_agent',
        'No agent that can run a chat is usable in this workspace, so no child session can start. No effects were applied.',
        { effectsApplied: false }
      )
    }
    const title = titleFor(input)
    const route = routeDelegationRequest({
      summary: input.summary,
      writes: input.writes,
      workspaceKind: parent.workspaceKind,
      parentAgent: parent.agent,
      agents,
      rateLimits: this.deps.readRateLimits(),
      now: this.deps.now()
    })
    const db = this.deps.requireDb()
    const row = db.createDelegationRequest({
      parentSessionId: parent.sessionId,
      title,
      summary: input.summary,
      prompt: input.prompt,
      writes: input.writes,
      workspaceKind: parent.workspaceKind,
      optionsJson: JSON.stringify({ agents }),
      decisionJson: route.status === 'routed' ? JSON.stringify(route.decision) : null
    })
    const card = buildDelegationCardContent({
      requestId: row.id,
      title,
      route,
      agents,
      writes: input.writes,
      workspaceKind: parent.workspaceKind
    })
    // Recorded before the card can be seen, so a card in the chat always has its question on record.
    const questionItemId = delegationQuestionItemId(row.id)
    db.patchDelegationRequest(row.id, { question_item_id: questionItemId })
    try {
      await this.deps.rows.appendHostRow(
        parent.sessionId,
        delegationQuestionRowIdentity(row.id),
        boundJournalPromptBody({
          kind: 'question',
          question: CARD_QUESTION,
          options: card.options,
          delegation: card.payload,
          resolution: {
            state: 'pending',
            selectedOptionId: null,
            resolvedBy: null,
            resolvedAt: null
          }
        })
      )
    } catch (error) {
      db.transitionDelegationRequest(row.id, 'pending', 'failed', {
        failure: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
    return { requestId: row.id, status: 'awaiting_choice', questionItemId }
  }
}
