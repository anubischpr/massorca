// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionPromptResponse } from '../../../../shared/agent-session-question-answer'
import { useStructuredPromptResponseHold } from './use-structured-prompt-response-hold'

type Hold = ReturnType<typeof useStructuredPromptResponseHold>

const response: AgentSessionPromptResponse = {
  kind: 'answers',
  answers: [{ questionId: 'q1', optionIds: ['agent:pi'] }]
}

function mountHold(respond: Parameters<typeof useStructuredPromptResponseHold>[0]): () => Hold {
  let current: Hold | undefined
  function Probe(): null {
    current = useStructuredPromptResponseHold(respond)
    return null
  }
  const container = document.createElement('div')
  act(() => createRoot(container).render(<Probe />))
  return () => {
    if (!current) {
      throw new Error('hook did not render')
    }
    return current
  }
}

describe('useStructuredPromptResponseHold', () => {
  it("forwards a delegation card's count and design system to the response", async () => {
    const respond = vi.fn(async () => null)
    const hold = mountHold(respond)
    const item = {
      itemId: 'i',
      revision: 1,
      sequence: 1,
      observedAt: 0,
      body: {
        kind: 'question' as const,
        question: 'q',
        options: [],
        resolution: {
          state: 'pending' as const,
          selectedOptionId: null,
          resolvedBy: null,
          resolvedAt: null
        }
      }
    }
    await act(async () => {
      await hold().respond(item, response, 3, 'propose')
    })
    expect(respond).toHaveBeenCalledWith(item, response, 3, 'propose')
  })
})
