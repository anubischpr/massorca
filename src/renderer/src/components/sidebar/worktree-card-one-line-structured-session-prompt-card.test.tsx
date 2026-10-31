/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OneLineStructuredSessionPrompt from './worktree-card-one-line-structured-session-prompt'

const mocks = vi.hoisted(() => ({
  read: vi.fn(() => ({ state: { fence: 1 } })),
  mutate: vi.fn(async () => ({ ok: true })),
  prompts: [] as unknown[]
}))

vi.mock('@/components/native-chat/use-structured-agent-session-read', () => ({
  useStructuredAgentSessionRead: mocks.read
}))
vi.mock('@/components/native-chat/use-structured-agent-session-mutate', () => ({
  useStructuredAgentSessionMutate: () => ({ mutate: mocks.mutate })
}))
vi.mock('@/components/native-chat/use-structured-agent-session-transport-state', () => ({
  useStructuredAgentSessionTransportState: () => ({ journalItems: [], turnId: 'turn-1' })
}))
vi.mock('@/components/native-chat/structured-agent-session-message-projection', () => ({
  pendingStructuredSessionPrompts: () => mocks.prompts
}))
vi.mock('@/runtime/structured-agent-session-client', () => ({
  supportsStructuredAgentSessionPromptCancel: async () => true,
  supportsStructuredAgentSessionQuestionAnswers: async () => true
}))
vi.mock('@/components/native-chat/NativeChatApprovalCard', () => ({
  NativeChatApprovalCard: () => <div>approval card</div>
}))
vi.mock('@/components/native-chat/NativeChatStructuredQuestionCard', () => ({
  NativeChatStructuredQuestionCard: (props: {
    onAnswer: (response: unknown) => void
    onCancel: () => void
  }) => (
    <div>
      <button onClick={() => props.onAnswer({ kind: 'answers', answers: [] })}>answer</button>
      <button onClick={props.onCancel}>cancel</button>
    </div>
  )
}))

const question = {
  itemId: 'item-1',
  revision: 3,
  body: { kind: 'question', resolution: { state: 'pending' }, questions: [] }
}

function renderPrompt(onDone = vi.fn()): ReturnType<typeof vi.fn> {
  render(
    <OneLineStructuredSessionPrompt
      sessionId="session-1"
      target={{ kind: 'local' }}
      agent="claude"
      fallback={<div>environment</div>}
      onDone={onDone}
    />
  )
  return onDone
}

describe('OneLineStructuredSessionPrompt', () => {
  afterEach(cleanup)

  beforeEach(() => {
    mocks.read.mockClear()
    mocks.mutate.mockClear()
    mocks.prompts = []
  })

  it('shows the fallback while nothing is pending, and reads without counting as a view', () => {
    renderPrompt()
    expect(screen.getByText('environment')).toBeTruthy()
    expect(mocks.read).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', isVisible: true, isViewed: false })
    )
  })

  it('answers a pending question through the host and closes the card', async () => {
    mocks.prompts = [question]
    const onDone = renderPrompt()
    expect(screen.queryByText('environment')).toBeNull()
    fireEvent.click(screen.getByText('answer'))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(mocks.mutate).toHaveBeenCalledWith(
      'agentSession.respondToQuestion',
      expect.anything(),
      expect.objectContaining({ itemId: 'item-1', expectedRevision: 3 })
    )
  })

  it('keeps the card open when the host refuses the answer', async () => {
    mocks.prompts = [question]
    mocks.mutate.mockResolvedValueOnce(null as never)
    const onDone = renderPrompt()
    fireEvent.click(screen.getByText('answer'))
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledOnce())
    expect(onDone).not.toHaveBeenCalled()
  })

  it('cancels the prompt on its own turn', async () => {
    mocks.prompts = [question]
    renderPrompt()
    fireEvent.click(screen.getByText('cancel'))
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        'agentSession.cancel',
        'agentSession.cancel',
        expect.objectContaining({
          turnId: 'turn-1',
          prompt: { itemId: 'item-1', expectedRevision: 3 }
        })
      )
    )
  })
})
