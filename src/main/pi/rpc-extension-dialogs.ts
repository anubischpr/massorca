import type { AgentSessionPromptResponse } from '../../shared/agent-session-question-answer'
import type { ProviderTimelineRequestBody } from '../native-chat/agent-session-timeline/provider-timeline-event'
import { piRpcDialogSchema, type PiRpcDialog } from './rpc-protocol'
import { parseToggleRound, type ToggleRound, type ToggleScript } from './rpc-toggle-select-rounds'

const pendingResolution = {
  state: 'pending',
  selectedOptionId: null,
  resolvedBy: null,
  resolvedAt: null
} as const

export type PiRpcDialogPresentation = {
  id: string | number
  body: ProviderTimelineRequestBody
  reply: (response: AgentSessionPromptResponse | null) => Record<string, unknown>
  /** Present for a multi-select: the rounds still to answer once `reply` toggled the first pick. */
  script?: (response: AgentSessionPromptResponse) => ToggleScript
  /** Pi's own deadline for the dialog, after which it no longer waits for an answer. */
  timeoutMs?: number
}

function dialogText(dialog: PiRpcDialog): string {
  return [dialog.title, dialog.message].filter((text) => text !== undefined).join('\n\n')
}

/** A Gentle Shell multi-select round as one grouped multi-select question. */
function toggleRoundPresentation(
  dialog: Extract<PiRpcDialog, { method: 'select' }>,
  round: ToggleRound
): PiRpcDialogPresentation {
  const options = round.labels.map((label, index) => ({ id: `option-${index}`, label }))
  const text = dialogText(dialog)
  const picked = (response: AgentSessionPromptResponse): number[] => {
    if (response.kind !== 'answers' || response.answers.length !== 1) {
      throw new Error('Dialog requires one answer')
    }
    const answer = response.answers[0]
    const indexes = answer.optionIds.map((id) => options.findIndex((option) => option.id === id))
    if (
      answer.questionId !== 'q1' ||
      answer.other !== undefined ||
      indexes.length === 0 ||
      indexes.includes(-1) ||
      new Set(indexes).size !== indexes.length
    ) {
      throw new Error('Selection must choose offered options')
    }
    return [...indexes].sort((left, right) => left - right)
  }
  return {
    id: dialog.id,
    body: {
      kind: 'question',
      question: text,
      options: [],
      questions: [{ id: 'q1', question: text, multiSelect: true, options }],
      resolution: pendingResolution
    },
    reply: (response) => {
      if (response === null) {
        return { cancelled: true }
      }
      return { value: dialog.options[picked(response)[0]] }
    },
    script: (response) => {
      const [first, ...rest] = picked(response)
      return {
        title: dialog.title,
        ticked: new Set([round.labels[first]]),
        remaining: rest.map((index) => round.labels[index])
      }
    }
  }
}

/** Terminal decoration is deliberately absent from the chat projection. */
export function piRpcDialogPresentation(value: unknown): PiRpcDialogPresentation | null {
  const parsed = piRpcDialogSchema.safeParse(value)
  if (!parsed.success) {
    return null
  }
  const dialog = parsed.data
  const timeout = dialog.timeout === undefined ? {} : { timeoutMs: dialog.timeout }
  const presentation = basePresentation(dialog)
  return { ...presentation, ...timeout }
}

function basePresentation(dialog: PiRpcDialog): PiRpcDialogPresentation {
  if (dialog.method === 'select') {
    const round = parseToggleRound(dialog.options)
    if (round && round.checked.every((checked) => !checked)) {
      return toggleRoundPresentation(dialog, round)
    }
  }
  if (dialog.method === 'confirm') {
    return {
      id: dialog.id,
      body: {
        kind: 'approval',
        title: dialog.title,
        detail: dialog.message ?? null,
        options: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' }
        ],
        resolution: pendingResolution
      },
      reply: (response) => {
        if (response === null) {
          return { cancelled: true }
        }
        if (response.kind !== 'option' || !['yes', 'no'].includes(response.optionId)) {
          throw new Error('Confirmation must select an offered option')
        }
        return { confirmed: response.optionId === 'yes' }
      }
    }
  }
  const questionId = String(dialog.id)
  const options =
    dialog.method === 'select'
      ? dialog.options.map((label, index) => ({
          id: `option-${index}`,
          label: label || 'Empty value'
        }))
      : []
  return {
    id: dialog.id,
    body: {
      kind: 'question',
      question: dialogText(dialog),
      options,
      resolution: pendingResolution,
      ...(dialog.method === 'select'
        ? {}
        : {
            freeTextQuestionId: questionId,
            freeTextInput: {
              allowEmpty: true,
              ...(dialog.method === 'editor'
                ? { multiline: true, initialValue: dialog.prefill ?? '' }
                : {}),
              ...(dialog.placeholder === undefined ? {} : { placeholder: dialog.placeholder })
            }
          })
    },
    reply: (response) => {
      if (response === null) {
        return { cancelled: true }
      }
      if (response.kind !== 'answers' || response.answers.length !== 1) {
        throw new Error('Dialog requires one answer')
      }
      const answer = response.answers[0]
      if (dialog.method === 'select') {
        const selected = options.findIndex((option) => option.id === answer.optionIds[0])
        if (answer.optionIds.length !== 1 || answer.other !== undefined || selected === -1) {
          throw new Error('Selection must choose an offered option')
        }
        return { value: dialog.options[selected] }
      }
      if (
        answer.questionId !== questionId ||
        answer.optionIds.length !== 0 ||
        answer.other === undefined
      ) {
        throw new Error('Dialog requires a text answer')
      }
      return { value: answer.other }
    }
  }
}
