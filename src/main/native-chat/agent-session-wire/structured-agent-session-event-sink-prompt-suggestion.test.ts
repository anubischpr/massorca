import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionJournal } from '../agent-session-journal/journal-store'
import { createDeferredStructuredAgentSessionEventSink } from './structured-agent-session-event-sink'
import { testEventSinkLogging } from './structured-agent-session-logger-test-support'

// A suggestion is a publication, ordered after the journal's writes but writing none.
// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a publication only calls readInOrder, which this stand-in runs at once.
const NO_JOURNAL = {
  readInOrder: (read: () => unknown) => read()
} as unknown as AgentSessionJournal

describe('deferred sink prompt suggestion', () => {
  it('publishes only the newest waiting suggestion once bound, and writes no journal row', async () => {
    const deferred = createDeferredStructuredAgentSessionEventSink(testEventSinkLogging())
    const publishPromptSuggestion = vi.fn()
    const publish = vi.fn()

    deferred.sink.setPromptSuggestion?.({ turnId: 'turn-1', text: 'First' })
    deferred.sink.setPromptSuggestion?.({ turnId: 'turn-1', text: 'Second' })
    deferred.bind({ journal: NO_JOURNAL, fence: 3, publish, publishPromptSuggestion })
    await deferred.drained()

    expect(publishPromptSuggestion).toHaveBeenCalledTimes(1)
    expect(publishPromptSuggestion).toHaveBeenCalledWith({ turnId: 'turn-1', text: 'Second' })
    expect(publish).not.toHaveBeenCalled()
  })

  it('publishes a clear, and tolerates a target with no suggestion channel', async () => {
    const deferred = createDeferredStructuredAgentSessionEventSink(testEventSinkLogging())
    const publishPromptSuggestion = vi.fn()
    deferred.bind({ journal: NO_JOURNAL, fence: 1, publish: vi.fn(), publishPromptSuggestion })
    deferred.sink.setPromptSuggestion?.(null)
    await deferred.drained()
    expect(publishPromptSuggestion).toHaveBeenCalledWith(null)

    const bare = createDeferredStructuredAgentSessionEventSink(testEventSinkLogging())
    bare.bind({ journal: NO_JOURNAL, fence: 1, publish: vi.fn() })
    bare.sink.setPromptSuggestion?.({ turnId: 't', text: 'x' })
    expect((await bare.drained()).ok).toBe(true)
  })
})
