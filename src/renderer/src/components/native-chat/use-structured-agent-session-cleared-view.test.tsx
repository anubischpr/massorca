// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { setNativeChatEarlierContextShown } from './native-chat-earlier-context-store'
import { useStructuredAgentSessionClearedView } from './use-structured-agent-session-cleared-view'

const message = (sequence: number, text: string): AgentJournalRenderItem => ({
  itemId: `row-${sequence}`,
  sequence,
  revision: 1,
  observedAt: sequence,
  body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text }] }
})
const clear: AgentJournalRenderItem = {
  itemId: 'row-3',
  sequence: 3,
  revision: 1,
  observedAt: 3,
  body: {
    kind: 'status',
    text: 'Context cleared',
    presentation: 'context-cleared',
    contextClear: { operationId: 'op', afterFence: 1, clearedAt: 3 }
  }
}
const ITEMS = [message(1, 'before'), message(2, 'also before'), clear, message(4, 'after')]

afterEach(() => {
  window.localStorage.clear()
  setNativeChatEarlierContextShown('session-a', false)
})

describe('useStructuredAgentSessionClearedView', () => {
  it('hides everything before the newest clear until the person shows it', () => {
    const { result } = renderHook(() =>
      useStructuredAgentSessionClearedView('session-a', 'codex', ITEMS, [])
    )
    expect(result.current.items.map((item) => item.sequence)).toEqual([3, 4])
    expect(result.current.earlierContext?.shown).toBe(false)

    act(() => result.current.earlierContext?.toggle())

    expect(result.current.items.map((item) => item.sequence)).toEqual([1, 2, 3, 4])
    expect(result.current.earlierContext?.shown).toBe(true)
    expect(window.localStorage.getItem('orca.nativeChat.earlierContext.session-a')).toBe('1')
  })

  it('offers nothing when the chat was never cleared', () => {
    const { result } = renderHook(() =>
      useStructuredAgentSessionClearedView('session-a', 'codex', [message(1, 'only')], [])
    )
    expect(result.current.earlierContext).toBeNull()
    expect(result.current.items).toHaveLength(1)
  })
})
