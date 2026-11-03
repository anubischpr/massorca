import { agentSessionCurrentContextRows } from './agent-session-context-clear'
import type {
  AgentJournalQuestionItem,
  AgentJournalRenderItem
} from './agent-session-journal-types'
import {
  legacyAgentSessionSelectedOptionId,
  type AgentSessionPromptResponse,
  type AgentSessionQuestionAnswer
} from './agent-session-question-answer'

/** A journal row holding a question that still waits for its answer. */
export type PendingStructuredSessionQuestion = AgentJournalRenderItem & {
  body: AgentJournalQuestionItem
}

function isPendingPrompt(item: AgentJournalRenderItem): boolean {
  return (
    (item.body.kind === 'approval' || item.body.kind === 'question') &&
    item.body.resolution.state === 'pending'
  )
}

function isPendingQuestion(item: AgentJournalRenderItem): item is PendingStructuredSessionQuestion {
  return item.body.kind === 'question' && item.body.resolution.state === 'pending'
}

/**
 * The question a structured chat's card draws: the oldest pending prompt in the current context,
 * which the thread shows first. Null when nothing is pending, or when that prompt is an approval,
 * because the thread draws the approval in the question's place.
 */
export function pendingStructuredSessionQuestion(
  items: readonly AgentJournalRenderItem[]
): PendingStructuredSessionQuestion | null {
  const rows: readonly AgentJournalRenderItem[] = agentSessionCurrentContextRows(items).items
  const oldest = rows.find(isPendingPrompt)
  return oldest !== undefined && isPendingQuestion(oldest) ? oldest : null
}

export type StructuredQuestionAnswerFields =
  | { itemId: string; expectedRevision: number; optionId: string }
  | { itemId: string; expectedRevision: number; answers: AgentSessionQuestionAnswer[] }

/**
 * The `respondToQuestion` fields for one response. A host that takes structured answers gets them
 * as given; an older host gets the option id its legacy reader expects, or null when that id cannot
 * name this response.
 */
export function structuredQuestionAnswerFields(
  item: Pick<AgentJournalRenderItem, 'itemId' | 'revision'> & { body: AgentJournalQuestionItem },
  response: AgentSessionPromptResponse,
  hostTakesAnswers: boolean
): StructuredQuestionAnswerFields | null {
  const target = { itemId: item.itemId, expectedRevision: item.revision }
  if (response.kind === 'option') {
    return { ...target, optionId: response.optionId }
  }
  if (hostTakesAnswers) {
    return { ...target, answers: response.answers }
  }
  const optionId = legacyAgentSessionSelectedOptionId(item.body, response.answers)
  return optionId === null ? null : { ...target, optionId }
}
