// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import type { DelegationStartedPayload } from '../../../../shared/delegated-session-journal'
import type { NativeChatLiveSession } from './use-native-chat-live-session'
import { NativeChatMessageListWithDelegatedChildren } from './NativeChatMessageListWithDelegatedChildren'

// Why: the probe reads the child the provider hands the list, which is the wiring under test.
vi.mock('./NativeChatMessageList', async () => {
  const { useDelegatedChild } = await import('./delegated-children-context')
  return {
    NativeChatMessageList: function ProbeMessageList() {
      const child = useDelegatedChild('request-1')
      return <p>{child?.status ?? 'no child'}</p>
    }
  }
})

afterEach(cleanup)

const session: NativeChatLiveSession = {
  messages: [],
  status: 'working',
  sessionId: 'session-1',
  agent: 'codex',
  hasMore: false,
  loadingEarlier: false,
  olderHistoryGeneration: 0,
  loadEarlier: vi.fn(),
  readPhase: 'ready'
}

const started: DelegationStartedPayload = {
  requestId: 'request-1',
  title: 'Explore',
  status: 'started',
  agent: 'codex',
  model: null,
  effort: null,
  childSessionId: 'child-1',
  placement: 'current',
  automatic: false
}

const startedItem: AgentJournalRenderItem = {
  itemId: 'request-1-started',
  revision: 1,
  sequence: 1,
  observedAt: 100,
  body: { kind: 'status', text: 'Explore', delegation: started }
}

describe('NativeChatMessageListWithDelegatedChildren', () => {
  it('hands the list the child its journal shows', () => {
    render(
      <NativeChatMessageListWithDelegatedChildren
        session={session}
        journalItems={[startedItem]}
        isWorking
        expandSignal={false}
      />
    )
    expect(screen.getByText('working')).toBeDefined()
  })

  it('hands the list no child without journal items', () => {
    render(
      <NativeChatMessageListWithDelegatedChildren
        session={session}
        isWorking
        expandSignal={false}
      />
    )
    expect(screen.getByText('no child')).toBeDefined()
  })
})
