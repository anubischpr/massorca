import { describe, expect, it } from 'vitest'
import type {
  AgentJournalQuestionItem,
  AgentJournalRenderItem,
  AgentJournalResolutionState
} from './agent-session-journal-types'
import {
  pendingStructuredSessionQuestion,
  structuredQuestionAnswerFields
} from './structured-session-pending-question'

function resolution(state: AgentJournalResolutionState) {
  return {
    state,
    selectedOptionId: state === 'resolved' ? 'yes' : null,
    resolvedBy: state === 'resolved' ? 'desk' : null,
    resolvedAt: state === 'resolved' ? 2 : null
  }
}

function questionRow(
  itemId: string,
  sequence: number,
  state: AgentJournalResolutionState = 'pending'
): AgentJournalRenderItem {
  return {
    itemId,
    revision: 1,
    sequence,
    observedAt: sequence,
    body: {
      kind: 'question',
      question: `Which for ${itemId}?`,
      options: [
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: 'No' }
      ],
      resolution: resolution(state)
    }
  }
}

function approvalRow(itemId: string, sequence: number): AgentJournalRenderItem {
  return {
    itemId,
    revision: 1,
    sequence,
    observedAt: sequence,
    body: {
      kind: 'approval',
      title: 'Allow Bash?',
      detail: null,
      options: [{ id: 'allow', label: 'Allow' }],
      resolution: resolution('pending')
    }
  }
}

function clearRow(itemId: string, sequence: number): AgentJournalRenderItem {
  return {
    itemId,
    revision: 1,
    sequence,
    observedAt: sequence,
    body: {
      kind: 'status',
      text: 'Context cleared',
      contextClear: { operationId: `clear-${itemId}`, afterFence: 1, clearedAt: sequence }
    }
  }
}

describe('pendingStructuredSessionQuestion', () => {
  it('returns the pending question row', () => {
    const pending = pendingStructuredSessionQuestion([questionRow('q1', 1)])
    expect(pending?.itemId).toBe('q1')
    expect(pending?.body.kind).toBe('question')
  })

  it('ignores resolved and cancelled questions', () => {
    expect(
      pendingStructuredSessionQuestion([
        questionRow('q1', 1, 'resolved'),
        questionRow('q2', 2, 'cancelled')
      ])
    ).toBeNull()
    expect(
      pendingStructuredSessionQuestion([
        questionRow('q1', 1, 'resolved'),
        questionRow('q2', 2, 'cancelled'),
        questionRow('q3', 3)
      ])?.itemId
    ).toBe('q3')
  })

  it('returns the oldest pending question, the one the thread card draws first', () => {
    const pending = pendingStructuredSessionQuestion([questionRow('q1', 1), questionRow('q2', 2)])
    expect(pending?.itemId).toBe('q1')
  })

  it('returns null while the oldest pending prompt is an approval', () => {
    expect(
      pendingStructuredSessionQuestion([approvalRow('a1', 1), questionRow('q1', 2)])
    ).toBeNull()
    expect(
      pendingStructuredSessionQuestion([questionRow('q1', 1), approvalRow('a1', 2)])?.itemId
    ).toBe('q1')
  })

  it('returns null when no question is pending', () => {
    expect(pendingStructuredSessionQuestion([])).toBeNull()
    expect(pendingStructuredSessionQuestion([clearRow('c1', 1)])).toBeNull()
    expect(pendingStructuredSessionQuestion([approvalRow('a1', 1)])).toBeNull()
  })

  it('ignores a pending question from before the newest context clear', () => {
    expect(
      pendingStructuredSessionQuestion([questionRow('q-old', 1), clearRow('c1', 2)])
    ).toBeNull()
    expect(
      pendingStructuredSessionQuestion([
        questionRow('q-old', 1),
        clearRow('c1', 2),
        questionRow('q-new', 3)
      ])?.itemId
    ).toBe('q-new')
  })
})

describe('structuredQuestionAnswerFields', () => {
  const single: AgentJournalQuestionItem = {
    kind: 'question',
    question: 'Pick a library',
    options: [
      { id: 'q1:react', label: 'React' },
      { id: 'q1:vue', label: 'Vue' }
    ],
    freeTextQuestionId: 'q1',
    resolution: resolution('pending')
  }
  const grouped: AgentJournalQuestionItem = {
    kind: 'question',
    question: 'Targets',
    options: [],
    questions: [
      {
        id: 'q1',
        question: 'Which targets?',
        multiSelect: false,
        options: [{ id: 'web', label: 'Web' }]
      }
    ],
    resolution: resolution('pending')
  }
  const singleItem = { itemId: 'q-single', revision: 1, body: single }
  const groupedItem = { itemId: 'q-group', revision: 3, body: grouped }

  it('sends an option choice by option id', () => {
    expect(
      structuredQuestionAnswerFields(groupedItem, { kind: 'option', optionId: 'web' }, false)
    ).toEqual({ itemId: 'q-group', expectedRevision: 3, optionId: 'web' })
  })

  it('sends structured answers when the host takes them', () => {
    const answers = [{ questionId: 'q1', optionIds: ['web'] }]
    expect(structuredQuestionAnswerFields(groupedItem, { kind: 'answers', answers }, true)).toEqual(
      { itemId: 'q-group', expectedRevision: 3, answers }
    )
  })

  it('packs a single-question answer into the legacy option id for an older host', () => {
    const answers = [{ questionId: 'q1', optionIds: ['q1:vue'] }]
    expect(structuredQuestionAnswerFields(singleItem, { kind: 'answers', answers }, false)).toEqual(
      { itemId: 'q-single', expectedRevision: 1, optionId: 'q1:vue' }
    )
  })

  it('packs a grouped answer into the legacy group encoding for an older host', () => {
    const answers = [{ questionId: 'q1', optionIds: ['web'] }]
    expect(
      structuredQuestionAnswerFields(groupedItem, { kind: 'answers', answers }, false)
    ).toEqual({
      itemId: 'q-group',
      expectedRevision: 3,
      optionId: 'question-group:[{"questionId":"q1","optionIds":["web"]}]'
    })
  })

  it('returns null when an older host cannot express the answer', () => {
    const answers = [
      { questionId: 'q1', optionIds: ['q1:vue'] },
      { questionId: 'q2', optionIds: ['q1:react'] }
    ]
    expect(
      structuredQuestionAnswerFields(singleItem, { kind: 'answers', answers }, false)
    ).toBeNull()
  })
})
