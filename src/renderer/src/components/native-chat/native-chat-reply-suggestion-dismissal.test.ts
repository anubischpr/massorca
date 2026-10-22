import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeChatReplySuggestion } from '../../../../shared/native-chat-reply-suggestion'
import { reportReplySuggestionDismissed } from './native-chat-reply-suggestion-dismissal'

const mocks = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: mocks.call
}))

const target = { kind: 'local' } as const
const SUGGESTION: NativeChatReplySuggestion = {
  turnId: 'turn-1',
  text: 'Run the tests',
  source: 'emulated'
}

describe('reportReplySuggestionDismissed', () => {
  beforeEach(() => {
    mocks.call.mockReset()
  })

  it('asks the host to drop the suggestion the chat dismissed', () => {
    mocks.call.mockResolvedValue({ dismissed: true })

    reportReplySuggestionDismissed(target, 'session-a', SUGGESTION)

    expect(mocks.call).toHaveBeenCalledTimes(1)
    expect(mocks.call).toHaveBeenCalledWith(target, 'agentSession.dismissPromptSuggestion', {
      sessionId: 'session-a',
      turnId: 'turn-1',
      text: 'Run the tests'
    })
  })

  it('takes a refusal from a host that predates the method without an unhandled error', async () => {
    mocks.call.mockRejectedValue(new Error('unknown method'))

    reportReplySuggestionDismissed(target, 'session-a', SUGGESTION)
    await Promise.resolve()
    await Promise.resolve()

    expect(mocks.call).toHaveBeenCalledTimes(1)
  })
})
