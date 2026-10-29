import type { AgentJournalRenderItem } from '../../../src/shared/agent-session-journal-types'
import {
  agentSessionPromptQuestions,
  type AgentSessionQuestionAnswer
} from '../../../src/shared/agent-session-question-answer'
import { readDelegationCardPayload } from '../../../src/shared/delegated-session-journal'
import type { MobileChatPermission } from './mobile-native-chat-permission'
import type { MobileChatQuestion } from './mobile-native-chat-question'
import type { MobileDelegationQuestion } from './mobile-delegation-card-model'
import {
  groupedQuestionPromptKey,
  projectGroupedQuestion,
  type GroupedQuestionDraft
} from './mobile-structured-grouped-question'
import {
  decodePromptToken,
  decodeQuestionFreeTextAnswer,
  encodePromptToken
} from './mobile-structured-prompt-token'

export type StructuredApprovalItem = AgentJournalRenderItem & {
  body: Extract<AgentJournalRenderItem['body'], { kind: 'approval' }>
}

export type StructuredQuestionItem = AgentJournalRenderItem & {
  body: Extract<AgentJournalRenderItem['body'], { kind: 'question' }>
}

export type StructuredPromptResponseTarget = {
  itemId: string
  expectedRevision: number
  optionId: string
}

export type StructuredQuestionResponseTarget = {
  itemId: string
  expectedRevision: number
  answer: AgentSessionQuestionAnswer
}

export function pendingStructuredApproval(
  item: AgentJournalRenderItem
): item is StructuredApprovalItem {
  return item.body.kind === 'approval' && item.body.resolution.state === 'pending'
}

export function pendingStructuredQuestion(
  item: AgentJournalRenderItem
): item is StructuredQuestionItem {
  return item.body.kind === 'question' && item.body.resolution.state === 'pending'
}

export function projectStructuredPermission(
  prompt: StructuredApprovalItem | null
): MobileChatPermission | null {
  if (prompt?.body.kind !== 'approval') {
    return null
  }
  return {
    title: prompt.body.title,
    prompt: { itemId: prompt.itemId, expectedRevision: prompt.revision },
    ...(prompt.body.displayName ? { displayName: prompt.body.displayName } : {}),
    ...(prompt.body.description ? { description: prompt.body.description } : {}),
    ...(prompt.body.decisionReason ? { decisionReason: prompt.body.decisionReason } : {}),
    ...(prompt.body.blockedPath ? { blockedPath: prompt.body.blockedPath } : {}),
    ...(prompt.body.subject ? { subject: prompt.body.subject } : {}),
    ...(prompt.body.detail ? { detail: prompt.body.detail } : {}),
    options: prompt.body.options.map((option) => ({
      label: option.label,
      send: encodePromptToken({
        kind: 'approval',
        itemId: prompt.itemId,
        revision: prompt.revision,
        optionId: option.id
      })
    }))
  }
}

export function projectStructuredQuestion(
  prompt: StructuredQuestionItem | null,
  groupedDraft: GroupedQuestionDraft | null = null
): MobileChatQuestion | null {
  if (prompt?.body.kind !== 'question') {
    return null
  }
  if (prompt.body.questions) {
    return projectGroupedQuestion(
      prompt.body.questions,
      groupedDraft,
      groupedQuestionPromptKey(prompt.itemId, prompt.revision),
      { itemId: prompt.itemId, expectedRevision: prompt.revision }
    )
  }
  const [question] = agentSessionPromptQuestions(prompt.body)
  if (!question) {
    return null
  }
  const optionDescriptions = prompt.body.options.map((option) => option.description)
  const delegation = projectDelegationQuestion(prompt, question.id)
  return {
    question: prompt.body.question,
    prompt: { itemId: prompt.itemId, expectedRevision: prompt.revision },
    options: prompt.body.options.map((option) => option.label),
    ...(optionDescriptions.some(Boolean) ? { optionDescriptions } : {}),
    multiSelect: false,
    allowOther: Boolean(prompt.body.freeTextQuestionId),
    ...(prompt.body.freeTextInput ? { freeTextInput: prompt.body.freeTextInput } : {}),
    optionTokens: prompt.body.options.map((option) =>
      encodePromptToken({
        kind: 'question-option',
        itemId: prompt.itemId,
        revision: prompt.revision,
        questionId: question.id,
        optionId: option.id
      })
    ),
    ...(prompt.body.freeTextQuestionId
      ? {
          freeTextToken: encodePromptToken({
            kind: 'question-free-text',
            itemId: prompt.itemId,
            revision: prompt.revision,
            questionId: prompt.body.freeTextQuestionId
          })
        }
      : {}),
    ...(delegation ? { delegation } : {})
  }
}

/** A delegated session's agent choice with the answer each option sends; null for any other question,
 *  or a card with nothing to choose, which the plain question draws instead. */
function projectDelegationQuestion(
  prompt: StructuredQuestionItem,
  questionId: string
): MobileDelegationQuestion | null {
  const card = readDelegationCardPayload(prompt.body.delegation)
  if (!card || (card.decision === null && card.agents.length === 0)) {
    return null
  }
  return {
    card,
    answerTokens: Object.fromEntries(
      prompt.body.options.map((option) => [
        option.id,
        encodePromptToken({
          kind: 'question-option',
          itemId: prompt.itemId,
          revision: prompt.revision,
          questionId,
          optionId: option.id
        })
      ])
    )
  }
}

export function structuredApprovalResponseTarget(
  response: string,
  currentPrompt: StructuredApprovalItem | null
): StructuredPromptResponseTarget | null {
  const token = decodePromptToken(response)
  if (token?.kind === 'approval') {
    return {
      itemId: token.itemId,
      expectedRevision: token.revision,
      optionId: token.optionId
    }
  }
  if (token) {
    return null
  }
  const option = currentPrompt?.body.options.find(
    (candidate) => candidate.id === response || candidate.label === response
  )
  return currentPrompt && option
    ? {
        itemId: currentPrompt.itemId,
        expectedRevision: currentPrompt.revision,
        optionId: option.id
      }
    : null
}

export function structuredQuestionResponseTarget(
  response: string,
  currentPrompt: StructuredQuestionItem | null
): StructuredQuestionResponseTarget | null {
  const token = decodePromptToken(response)
  if (token?.kind === 'question-option') {
    return {
      itemId: token.itemId,
      expectedRevision: token.revision,
      answer: { questionId: token.questionId, optionIds: [token.optionId] }
    }
  }
  if (token) {
    return null
  }
  const freeText = decodeQuestionFreeTextAnswer(response)
  if (freeText) {
    const allowEmpty =
      currentPrompt?.itemId === freeText.payload.itemId &&
      currentPrompt.revision === freeText.payload.revision &&
      currentPrompt.body.freeTextQuestionId === freeText.payload.questionId &&
      currentPrompt.body.freeTextInput?.allowEmpty === true
    const answer = allowEmpty ? freeText.answer : freeText.answer.trim()
    return answer.length > 0 || allowEmpty
      ? {
          itemId: freeText.payload.itemId,
          expectedRevision: freeText.payload.revision,
          answer: { questionId: freeText.payload.questionId, optionIds: [], other: answer }
        }
      : null
  }
  if (!currentPrompt) {
    return null
  }
  const [question] = agentSessionPromptQuestions(currentPrompt.body)
  const trimmed = response.trim()
  const allowEmpty = currentPrompt.body.freeTextInput?.allowEmpty === true
  const option = currentPrompt.body.options.find(
    (candidate) => candidate.id === response || candidate.label === trimmed
  )
  if (question && option) {
    return {
      itemId: currentPrompt.itemId,
      expectedRevision: currentPrompt.revision,
      answer: { questionId: question.id, optionIds: [option.id] }
    }
  }
  return question && currentPrompt.body.freeTextQuestionId && (trimmed || allowEmpty)
    ? {
        itemId: currentPrompt.itemId,
        expectedRevision: currentPrompt.revision,
        answer: { questionId: question.id, optionIds: [], other: allowEmpty ? response : trimmed }
      }
    : null
}
