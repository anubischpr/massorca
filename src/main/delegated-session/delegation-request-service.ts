import { boundJournalPromptBody } from '../native-chat/agent-session-journal/journal-prompt-body-bounds'
import { OrchestrationError } from '../runtime/orchestration/orchestration-error'
import {
  delegationQuestionItemId,
  delegationQuestionRowIdentity,
  type DelegationPrototypeCount
} from '../../shared/delegated-session-journal'
import {
  PROTOTYPE_CARD_COUNT_CHOICES,
  sanitizePrototypeCountSetting
} from '../../shared/prototype-count-setting'
import { neutralizePrototypeMarkers } from '../../shared/prototype-hidden-instruction'
import { decideDelegatedTaskPrototypeCount } from '../../shared/prototype-request-decision'
import { PROTOTYPE_PROMPT_MAX_LENGTH } from '../../shared/rpc-contract/prototype-params'
import { prototypeAgentOfChild } from './delegated-child-first-prompt'
import {
  buildDelegationCardContent,
  routeDelegationRequest,
  type DelegationStoredAgent
} from './delegation-options'
import type { DelegationRequestDeps } from './delegation-service-types'
import { waitForDelegationUsageRefresh } from './delegation-usage-refresh'

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

/**
 * The count question a task that asks for prototypes puts on its card. A task too long for a child's
 * first prompt makes no prototype request, so it asks nothing.
 */
function prototypeCountFor(
  input: DelegationRequestInput,
  agents: readonly DelegationStoredAgent[],
  readSetting: () => unknown
): DelegationPrototypeCount | undefined {
  if (input.prompt.length > PROTOTYPE_PROMPT_MAX_LENGTH) {
    return undefined
  }
  const decision = decideDelegatedTaskPrototypeCount({
    text: neutralizePrototypeMarkers(input.prompt),
    agents: agents.map((agent) => prototypeAgentOfChild(agent.agent, agent.piRuntime)),
    setting: sanitizePrototypeCountSetting(readSetting())
  })
  return decision.kind === 'ask'
    ? { choices: PROTOTYPE_CARD_COUNT_CHOICES, defaultCount: decision.defaultCount }
    : undefined
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
    await waitForDelegationUsageRefresh(this.deps.refreshUsage)
    const route = routeDelegationRequest({
      summary: input.summary,
      title,
      prompt: input.prompt,
      writes: input.writes,
      workspaceKind: parent.workspaceKind,
      parentAgent: parent.agent,
      agents,
      rateLimits: this.deps.readRateLimits(),
      now: this.deps.now()
    })
    const prototypeCount = prototypeCountFor(input, agents, this.deps.readPrototypeCount)
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
      summary: input.summary,
      prompt: input.prompt,
      route,
      agents,
      writes: input.writes,
      workspaceKind: parent.workspaceKind,
      ...(prototypeCount ? { prototypeCount } : {})
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
