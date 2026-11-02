// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { usePendingSessionQuestion } from './use-pending-session-question'

const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  answersSupported: vi.fn(),
  promptCancelSupported: vi.fn(),
  operationId: vi.fn(() => 'operation-1')
}))

vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: mocks.call,
  supportsStructuredAgentSessionQuietRepeatedStop: vi.fn(async () => false),
  supportsStructuredAgentSessionQuestionAnswers: mocks.answersSupported,
  supportsStructuredAgentSessionPromptCancel: mocks.promptCancelSupported
}))
vi.mock('./use-structured-agent-session-read', () => ({
  useStructuredAgentSessionRead: () => ({
    state: {
      fence: 3,
      items,
      submissions: [],
      status: 'ready',
      error: null,
      hasOlder: false,
      handoff: null
    },
    loadingOlder: false,
    loadOlder: vi.fn()
  })
}))
vi.mock('./structured-agent-session-operation-id', () => ({
  structuredSessionOperationId: mocks.operationId
}))

let items: AgentJournalRenderItem[] = []
const target = { kind: 'local' } as const

function runningTurn(): AgentJournalRenderItem {
  return {
    itemId: 'turn-status',
    revision: 1,
    sequence: 1,
    observedAt: 1,
    body: {
      kind: 'status',
      text: 'Waiting',
      turnLifecycle: { turnId: 'turn-1', state: 'running' }
    }
  }
}

function groupedQuestion(state: 'pending' | 'resolved' = 'pending'): AgentJournalRenderItem {
  return {
    itemId: 'q-group',
    revision: 3,
    sequence: 2,
    observedAt: 2,
    body: {
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
      resolution: {
        state,
        selectedOptionId: null,
        resolvedBy: state === 'resolved' ? 'desk' : null,
        resolvedAt: state === 'resolved' ? 4 : null
      }
    }
  }
}

function singleQuestion(): AgentJournalRenderItem {
  return {
    itemId: 'q-single',
    revision: 1,
    sequence: 2,
    observedAt: 2,
    body: {
      kind: 'question',
      question: 'Pick a library',
      options: [
        { id: 'q1:react', label: 'React' },
        { id: 'q1:vue', label: 'Vue' }
      ],
      freeTextQuestionId: 'q1',
      resolution: {
        state: 'pending',
        selectedOptionId: null,
        resolvedBy: null,
        resolvedAt: null
      }
    }
  }
}

describe('usePendingSessionQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    items = [runningTurn(), groupedQuestion()]
    mocks.call.mockResolvedValue({ ok: true, value: { turnId: 'turn-1', cancelled: true } })
    mocks.answersSupported.mockResolvedValue(true)
    mocks.promptCancelSupported.mockResolvedValue(true)
  })

  it('stays idle without a session or a runtime target', () => {
    const noSession = renderHook(() => usePendingSessionQuestion(null, { target, agent: 'claude' }))
    const noTarget = renderHook(() =>
      usePendingSessionQuestion('s1', { target: null, agent: 'claude' })
    )
    expect(noSession.result.current).toBeNull()
    expect(noTarget.result.current).toBeNull()
    expect(mocks.call).not.toHaveBeenCalled()
  })

  it('returns the pending question with the data its card draws', () => {
    const { result } = renderHook(() =>
      usePendingSessionQuestion('s1', { target, agent: 'claude' })
    )
    expect(result.current).toMatchObject({ itemId: 'q-group', revision: 3, isSubmitting: false })
    expect(result.current?.prompt.questions).toEqual([
      {
        id: 'q1',
        question: 'Which targets?',
        multiSelect: false,
        options: [{ id: 'web', label: 'Web' }]
      }
    ])
    expect(result.current?.prompt.delegation).toBeUndefined()
  })

  it('returns null once the question is resolved', () => {
    items = [runningTurn(), groupedQuestion('resolved')]
    const { result } = renderHook(() =>
      usePendingSessionQuestion('s1', { target, agent: 'claude' })
    )
    expect(result.current).toBeNull()
  })

  it('answers through respondToQuestion with structured answers when the host takes them', async () => {
    const { result } = renderHook(() =>
      usePendingSessionQuestion('s1', { target, agent: 'claude' })
    )
    const answers = [{ questionId: 'q1', optionIds: ['web'] }]
    await act(async () => {
      await result.current?.answer({ kind: 'answers', answers })
    })
    expect(mocks.call).toHaveBeenCalledWith(
      target,
      'agentSession.respondToQuestion',
      expect.objectContaining({ itemId: 'q-group', expectedRevision: 3, answers })
    )
  })

  it('answers with the legacy option id for a host without structured answers', async () => {
    items = [runningTurn(), singleQuestion()]
    mocks.answersSupported.mockResolvedValue(false)
    const { result } = renderHook(() =>
      usePendingSessionQuestion('s1', { target, agent: 'claude' })
    )
    await act(async () => {
      await result.current?.answer({
        kind: 'answers',
        answers: [{ questionId: 'q1', optionIds: ['q1:vue'] }]
      })
    })
    const answerCall = mocks.call.mock.calls.find(
      ([, method]) => method === 'agentSession.respondToQuestion'
    )
    expect(answerCall?.[2]).toEqual(
      expect.objectContaining({ itemId: 'q-single', expectedRevision: 1, optionId: 'q1:vue' })
    )
    expect(answerCall?.[2]).not.toHaveProperty('answers')
  })

  it('holds the card while the host takes the answer and releases it when the call fails', async () => {
    const { result } = renderHook(() =>
      usePendingSessionQuestion('s1', { target, agent: 'claude' })
    )
    await act(async () => {
      await result.current?.answer({
        kind: 'answers',
        answers: [{ questionId: 'q1', optionIds: ['web'] }]
      })
    })
    expect(result.current?.isSubmitting).toBe(true)

    mocks.call.mockImplementation((_target: unknown, method: string) =>
      method === 'agentSession.respondToQuestion'
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ ok: true, value: {} })
    )
    await act(async () => {
      await result.current?.answer({
        kind: 'answers',
        answers: [{ questionId: 'q1', optionIds: ['web'] }]
      })
    })
    expect(result.current?.isSubmitting).toBe(false)
  })

  it('cancels the running turn and names the prompt it answers', async () => {
    const { result } = renderHook(() =>
      usePendingSessionQuestion('s1', { target, agent: 'claude' })
    )
    await act(async () => {
      await result.current?.cancel()
    })
    expect(mocks.call).toHaveBeenCalledWith(
      target,
      'agentSession.cancel',
      expect.objectContaining({
        turnId: 'turn-1',
        prompt: { itemId: 'q-group', expectedRevision: 3 }
      })
    )
  })

  it('cancels only with a running turn, except for a pi session', async () => {
    items = [groupedQuestion()]
    const claude = renderHook(() => usePendingSessionQuestion('s1', { target, agent: 'claude' }))
    await act(async () => {
      await claude.result.current?.cancel()
    })
    expect(mocks.call).not.toHaveBeenCalledWith(target, 'agentSession.cancel', expect.anything())

    const pi = renderHook(() => usePendingSessionQuestion('s1', { target, agent: 'pi' }))
    await act(async () => {
      await pi.result.current?.cancel()
    })
    expect(mocks.call).toHaveBeenCalledWith(
      target,
      'agentSession.cancel',
      expect.objectContaining({ prompt: { itemId: 'q-group', expectedRevision: 3 } })
    )
  })
})
