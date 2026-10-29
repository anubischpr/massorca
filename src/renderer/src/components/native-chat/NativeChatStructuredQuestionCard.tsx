import type { RefObject } from 'react'
import type { AgentJournalQuestion } from '../../../../shared/agent-session-journal-types'
import type { AgentSessionPromptResponse } from '../../../../shared/agent-session-question-answer'
import { readDelegationCardPayload } from '../../../../shared/delegated-session-journal'
import { NativeChatDelegationCard } from './NativeChatDelegationCard'
import { NativeChatQuestionCard } from './NativeChatQuestionCard'

export function NativeChatStructuredQuestionCard({
  questions,
  onAnswer,
  onCancel,
  isSubmitting,
  shouldFocus,
  answerInputRef,
  delegation
}: {
  questions: readonly AgentJournalQuestion[]
  onAnswer: (response: AgentSessionPromptResponse) => void
  onCancel: () => void
  isSubmitting?: boolean
  shouldFocus?: boolean
  answerInputRef?: RefObject<HTMLInputElement | null>
  /** The question's delegation extension as it arrived; invalid or absent draws the plain question. */
  delegation?: unknown
}): React.JSX.Element {
  const [only] = questions
  const card = readDelegationCardPayload(delegation)
  if (
    card &&
    questions.length === 1 &&
    only &&
    (card.decision !== null || card.agents.length > 0)
  ) {
    return (
      <NativeChatDelegationCard
        body={card}
        question={only.question}
        questionId={only.id}
        isSubmitting={isSubmitting}
        onAnswer={onAnswer}
        onCancel={onCancel}
        shouldFocus={shouldFocus}
      />
    )
  }
  return (
    <NativeChatQuestionCard
      prompt={{
        questions: questions.map((question) => ({
          question: question.question,
          ...(question.header ? { header: question.header } : {}),
          multiSelect: question.multiSelect,
          options: question.options.map((option) => ({
            label: option.label,
            ...(option.description ? { description: option.description } : {})
          }))
        }))
      }}
      allowOther={questions.map((question) => Boolean(question.freeTextQuestionId))}
      freeTextInputs={questions.map((question) => question.freeTextInput)}
      onAnswer={(answers) => {
        const chosen = questions.map((question, index) => {
          const answer = answers[index]
          const other = question.freeTextInput?.allowEmpty ? answer?.other : answer?.other?.trim()
          return {
            questionId: question.id,
            optionIds: (answer?.indices ?? []).flatMap((optionIndex) => {
              const id = question.options[optionIndex]?.id
              return id ? [id] : []
            }),
            ...(other !== undefined && (other.length > 0 || question.freeTextInput?.allowEmpty)
              ? { other }
              : {})
          }
        })
        if (chosen.every((answer) => answer.optionIds.length > 0 || answer.other !== undefined)) {
          onAnswer({ kind: 'answers', answers: chosen })
        }
      }}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      shouldFocus={shouldFocus}
      answerInputRef={answerInputRef}
    />
  )
}
