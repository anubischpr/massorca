import { describe, expect, it, vi } from 'vitest'
import type { RuntimeClientTarget } from '@/runtime/runtime-rpc-client'
import type { AgentSessionPromptResponse } from '../../../../shared/agent-session-question-answer'
import type { StructuredPromptItem } from './structured-agent-session-message-projection'
import { respondToStructuredAgentSessionPrompt } from './structured-agent-session-prompt-response'
import type { StructuredAgentSessionMutate } from './use-structured-agent-session-mutate'

const host = vi.hoisted(() => ({ takesAnswers: true }))

vi.mock('@/runtime/structured-agent-session-client', () => ({
  supportsStructuredAgentSessionQuestionAnswers: () => Promise.resolve(host.takesAnswers)
}))

const target: RuntimeClientTarget = { kind: 'local' }

const item: Pick<StructuredPromptItem, 'itemId' | 'revision' | 'body'> = {
  itemId: 'item-1',
  revision: 3,
  body: {
    kind: 'question',
    question: 'Which agent should handle this session?',
    options: [{ id: 'agent:codex', label: 'Codex' }],
    resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
  }
}

const picked: AgentSessionPromptResponse = {
  kind: 'answers',
  answers: [{ questionId: 'q1', optionIds: ['agent:codex'] }]
}

type Sent = { method: string; fields: Record<string, unknown> }

function recordingMutate(): { sent: Sent[]; mutate: StructuredAgentSessionMutate } {
  const sent: Sent[] = []
  return {
    sent,
    mutate: async (method, _fingerprint, fields) => {
      sent.push({ method, fields })
      return null
    }
  }
}

describe('respondToStructuredAgentSessionPrompt count', () => {
  it('keeps the count out of the legacy optionId answer so an older host takes its default', async () => {
    host.takesAnswers = false
    const { sent, mutate } = recordingMutate()
    await respondToStructuredAgentSessionPrompt({
      item,
      response: picked,
      target,
      mutate,
      count: 2
    })
    expect(sent).toEqual([
      {
        method: 'agentSession.respondToQuestion',
        fields: { itemId: 'item-1', expectedRevision: 3, optionId: 'agent:codex' }
      }
    ])
  })

  it('sends the count with the answers to a host that takes question answers', async () => {
    host.takesAnswers = true
    const { sent, mutate } = recordingMutate()
    await respondToStructuredAgentSessionPrompt({
      item,
      response: picked,
      target,
      mutate,
      count: 2
    })
    expect(sent).toEqual([
      {
        method: 'agentSession.respondToQuestion',
        fields: {
          itemId: 'item-1',
          expectedRevision: 3,
          answers: [{ questionId: 'q1', optionIds: ['agent:codex'] }],
          count: 2
        }
      }
    ])
  })

  it('omits the count when no count button was clicked', async () => {
    host.takesAnswers = true
    const { sent, mutate } = recordingMutate()
    await respondToStructuredAgentSessionPrompt({ item, response: picked, target, mutate })
    expect(sent[0]?.fields).not.toHaveProperty('count')
  })

  it('sends the design system choice with the count, and omits it when none was asked', async () => {
    host.takesAnswers = true
    const { sent, mutate } = recordingMutate()
    await respondToStructuredAgentSessionPrompt({
      item,
      response: picked,
      target,
      mutate,
      count: 3,
      designSystem: 'propose'
    })
    await respondToStructuredAgentSessionPrompt({ item, response: picked, target, mutate })
    expect(sent[0]?.fields).toMatchObject({ count: 3, designSystem: 'propose' })
    expect(sent[1]?.fields).not.toHaveProperty('designSystem')
  })

  it('keeps the design system choice out of an approval, whose RPC is strict', async () => {
    host.takesAnswers = true
    const { sent, mutate } = recordingMutate()
    await respondToStructuredAgentSessionPrompt({
      item: {
        ...item,
        body: {
          kind: 'approval',
          title: 'Run a command',
          detail: null,
          options: [],
          resolution: item.body.resolution
        }
      },
      response: { kind: 'option', optionId: 'allow' },
      target,
      mutate,
      designSystem: 'skip'
    })
    expect(sent[0]?.fields).not.toHaveProperty('designSystem')
  })
})
