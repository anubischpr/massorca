import { describe, expect, it } from 'vitest'
import type { AgentSessionHistoryPage, AgentSessionSubscribeEvent } from './agent-session-wire'
import type { NativeChatReplySuggestion } from './native-chat-reply-suggestion'
import {
  EMPTY_STRUCTURED_AGENT_SESSION,
  reduceStructuredAgentSession,
  type StructuredAgentSessionState
} from './structured-agent-session-reducer'

const suggestion: NativeChatReplySuggestion = { turnId: 'turn-1', text: 'Run it', source: 'native' }

const page: AgentSessionHistoryPage = {
  sessionId: 'session-a',
  epoch: 'epoch-a',
  direction: 'tail',
  items: [],
  removedItemIds: [],
  submissions: [],
  window: { oldest: null, newest: null, nextCursor: { epoch: 'epoch-a', sequence: 0 } },
  liveCursor: { epoch: 'epoch-a', sequence: 0 },
  hasOlder: false,
  hasNewer: false
}

const apply = (
  state: StructuredAgentSessionState,
  event: AgentSessionSubscribeEvent,
  opensSubscription?: boolean
) =>
  reduceStructuredAgentSession(state, {
    type: 'event',
    event,
    ...(opensSubscription ? { opensSubscription } : {})
  })

const snapshot = (promptSuggestion?: NativeChatReplySuggestion): AgentSessionSubscribeEvent => ({
  type: 'snapshot',
  sessionId: 'session-a',
  fence: 1,
  page,
  ...(promptSuggestion ? { promptSuggestion } : {})
})

const batch = (
  state: StructuredAgentSessionState,
  promptSuggestion?: NativeChatReplySuggestion | null
): AgentSessionSubscribeEvent => ({
  type: 'batch',
  sessionId: 'session-a',
  batch: { cursor: state.cursor!, items: [], removedItemIds: [], submissions: [] },
  ...(promptSuggestion !== undefined ? { promptSuggestion } : {})
})

describe('reducer prompt suggestion', () => {
  it('holds a published suggestion across frames that do not mention it, until cleared', () => {
    const start = apply(EMPTY_STRUCTURED_AGENT_SESSION, snapshot())
    const shown = apply(start, batch(start, suggestion))
    expect(shown.promptSuggestion).toEqual(suggestion)

    const later = apply(shown, batch(shown))
    expect(later.promptSuggestion).toEqual(suggestion)
    expect(later).toBe(shown)

    const cleared = apply(later, batch(later, null))
    expect(cleared.promptSuggestion).toBeNull()
  })

  it('takes a snapshot to mean what the host holds now, so no field clears it', () => {
    const start = apply(EMPTY_STRUCTURED_AGENT_SESSION, snapshot(suggestion))
    expect(start.promptSuggestion).toEqual(suggestion)
    expect(apply(start, snapshot()).promptSuggestion).toBeNull()
  })

  it('clears on the opening frame of a new subscription that states none', () => {
    const start = apply(EMPTY_STRUCTURED_AGENT_SESSION, snapshot(suggestion))
    expect(apply(start, batch(start), true).promptSuggestion).toBeNull()
    expect(apply(start, batch(start, suggestion), true).promptSuggestion).toEqual(suggestion)
  })

  it('keeps it through a history page read', () => {
    const start = apply(EMPTY_STRUCTURED_AGENT_SESSION, snapshot(suggestion))
    const next = reduceStructuredAgentSession(start, { type: 'history-page', page })
    expect(next.promptSuggestion).toEqual(suggestion)
  })
})
