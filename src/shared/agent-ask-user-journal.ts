/**
 * What `orca orchestration ask-user` writes into the calling chat: an ordinary question item, so
 * every client draws it as the same card a provider's own question tool raises. The host owns it:
 * the answer goes back to the command that is waiting, never to the provider adapter.
 */

import { z } from 'zod'
import { agentJournalItemKey, parseAgentJournalItemKey } from './agent-session-journal-item-key'
import type {
  AgentJournalItemIdentity,
  AgentJournalQuestion,
  AgentJournalQuestionItem
} from './agent-session-journal-types'
import type { AgentSessionQuestionAnswer } from './agent-session-question-answer'

const QUESTION_ROW_PREFIX = 'ask-user:'

/** The most questions one card groups; matches the journal's grouped-question bound. */
export const ASK_USER_MAX_QUESTIONS = 4
export const ASK_USER_MAX_OPTIONS = 12

const AskUserOption = z.union([
  z.string().trim().min(1),
  z.object({ label: z.string().trim().min(1), description: z.string().optional() })
])

const AskUserQuestionInput = z.object({
  question: z.string().trim().min(1),
  header: z.string().optional(),
  options: z.array(AskUserOption).min(1).max(ASK_USER_MAX_OPTIONS),
  // Antigravity's own tool names it `is_multi_select`; Claude's names it `multiSelect`.
  multiSelect: z.boolean().optional(),
  is_multi_select: z.boolean().optional()
})

/** The `--questions` value: the canonical `{questions:[...]}` shape, or the bare array. */
export const AskUserQuestionsInput = z.union([
  z.object({ questions: z.array(AskUserQuestionInput).min(1).max(ASK_USER_MAX_QUESTIONS) }),
  z.array(AskUserQuestionInput).min(1).max(ASK_USER_MAX_QUESTIONS)
])

export type AskUserQuestionsInputValue = z.infer<typeof AskUserQuestionsInput>

/**
 * One question from plain flags, the form that survives every shell: Windows PowerShell strips the
 * double quotes out of a JSON argument it hands a `.cmd` launcher.
 */
export function askUserQuestionFromFlags(input: {
  question: string
  options: string
  multiSelect: boolean
}): AskUserQuestionsInputValue {
  return {
    questions: [
      {
        question: input.question.trim(),
        options: input.options
          .split(',')
          .map((option) => option.trim())
          .filter((option) => option.length > 0),
        multiSelect: input.multiSelect
      }
    ]
  }
}

export function askUserQuestionRowIdentity(
  requestId: string
): Extract<AgentJournalItemIdentity, { provider: 'orca' }> {
  return { provider: 'orca', clientMessageId: `${QUESTION_ROW_PREFIX}${requestId}` }
}

export function askUserQuestionItemId(requestId: string): string {
  return agentJournalItemKey(askUserQuestionRowIdentity(requestId))
}

/** The request an ask-user card's journal key belongs to; null for any other item. */
export function askUserRequestIdOfQuestionItem(itemId: string): string | null {
  const identity = parseAgentJournalItemKey(itemId)
  if (identity?.provider !== 'orca' || !identity.clientMessageId.startsWith(QUESTION_ROW_PREFIX)) {
    return null
  }
  const requestId = identity.clientMessageId.slice(QUESTION_ROW_PREFIX.length)
  return requestId.length > 0 ? requestId : null
}

/** The pending card for parsed `--questions`; every question accepts a typed answer too. */
export function buildAskUserQuestionBody(
  input: AskUserQuestionsInputValue
): AgentJournalQuestionItem {
  const raw = Array.isArray(input) ? input : input.questions
  const questions: AgentJournalQuestion[] = raw.map((entry, index) => {
    const id = `q${index + 1}`
    const header = entry.header?.trim()
    return {
      id,
      question: entry.question,
      ...(header ? { header } : {}),
      multiSelect: entry.multiSelect ?? entry.is_multi_select ?? false,
      options: entry.options.map((option, optionIndex) => {
        const value = typeof option === 'string' ? { label: option } : option
        const description = value.description?.trim()
        return {
          id: `${id}:choice-${optionIndex + 1}`,
          label: value.label,
          ...(description ? { description } : {})
        }
      }),
      freeTextQuestionId: id
    }
  })
  // One plain single-select question also reads as a flat card on clients that predate grouping.
  const flat = questions.length === 1 && !questions[0]!.multiSelect ? questions[0]! : null
  return {
    kind: 'question',
    question: flat
      ? flat.question
      : `${questions.length} question${questions.length === 1 ? '' : 's'} from the agent`,
    options: flat ? flat.options : [],
    ...(flat ? { freeTextQuestionId: flat.freeTextQuestionId } : {}),
    questions,
    resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
  }
}

export type AskUserAnswer = {
  question: string
  /** The chosen option labels, in option order. */
  selected: string[]
  /** Text the person typed instead of, or beside, a choice. */
  other?: string
}

/** Each question's answer by label, in question order; an unanswered question has none. */
export function readAskUserAnswers(
  questions: readonly AgentJournalQuestion[],
  answers: readonly AgentSessionQuestionAnswer[]
): AskUserAnswer[] {
  return questions.map((question) => {
    const answer = answers.find((entry) => entry.questionId === question.id)
    const selected = question.options
      .filter((option) => answer?.optionIds.includes(option.id))
      .map((option) => option.label)
    const other = answer?.other?.trim()
    return { question: question.question, selected, ...(other ? { other } : {}) }
  })
}

/** One line per question: the chosen labels and typed text joined by ", ". */
export function formatAskUserAnswers(answers: readonly AskUserAnswer[]): string {
  return answers
    .map((answer) => [...answer.selected, ...(answer.other ? [answer.other] : [])].join(', '))
    .join('\n')
}
