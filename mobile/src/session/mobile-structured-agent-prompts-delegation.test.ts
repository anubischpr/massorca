import { describe, expect, it } from 'vitest'
import { agentSessionPromptQuestions } from '../../../src/shared/agent-session-question-answer'
import type { DelegationCardPayload } from '../../../src/shared/delegated-session-journal'
import {
  projectStructuredQuestion,
  structuredQuestionResponseTarget,
  type StructuredQuestionItem
} from './mobile-structured-agent-prompts'

const card: DelegationCardPayload = {
  requestId: 'request-1',
  title: 'Explore Gentle Shell v5',
  decision: null,
  agents: [
    {
      agent: 'codex',
      label: 'Codex',
      usage: {
        agent: 'codex',
        bindingPercent: 34,
        window: 'weekly',
        noData: false,
        excluded: null
      },
      model: null,
      effort: null
    }
  ],
  placement: 'current',
  placementWarning: null
}

function prompt(options: { delegation?: DelegationCardPayload }): StructuredQuestionItem {
  return {
    itemId: 'item-delegation',
    revision: 7,
    sequence: 1,
    observedAt: 1,
    body: {
      kind: 'question',
      question: 'Which agent should handle this session?',
      options: [
        { id: 'automatic', label: 'Automatic' },
        { id: 'agent:codex', label: 'Codex' }
      ],
      ...(options.delegation ? { delegation: options.delegation } : {}),
      resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
    }
  }
}

describe('mobile structured delegation questions', () => {
  it('projects the card with the answer token each option sends', () => {
    const item = prompt({ delegation: card })
    const projected = projectStructuredQuestion(item)

    expect(projected?.delegation?.card).toEqual(card)
    expect(Object.keys(projected?.delegation?.answerTokens ?? {}).sort()).toEqual([
      'agent:codex',
      'automatic'
    ])
  })

  it('answers each option through the ordinary structured answer target', () => {
    const item = prompt({ delegation: card })
    const projected = projectStructuredQuestion(item)
    const [question] = agentSessionPromptQuestions(item.body)
    const tokens = projected?.delegation?.answerTokens ?? {}

    for (const optionId of ['automatic', 'agent:codex']) {
      expect(structuredQuestionResponseTarget(tokens[optionId] ?? '', item)).toEqual({
        itemId: 'item-delegation',
        expectedRevision: 7,
        answer: { questionId: question!.id, optionIds: [optionId] }
      })
    }
  })

  it('draws the plain question when the question carries no delegation', () => {
    const projected = projectStructuredQuestion(prompt({}))

    expect(projected?.delegation).toBeUndefined()
    expect(projected?.options).toEqual(['Automatic', 'Codex'])
  })

  it('draws the plain question when the card has nothing to choose', () => {
    const empty = { ...card, decision: null, agents: [] }

    expect(projectStructuredQuestion(prompt({ delegation: empty }))?.delegation).toBeUndefined()
  })
})
