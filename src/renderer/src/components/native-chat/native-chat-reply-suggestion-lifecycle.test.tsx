// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeChatReplySuggestion } from '../../../../shared/native-chat-reply-suggestion'
import type { NativeChatComposerInput } from './native-chat-composer-input'
import { useNativeChatComposerReplySuggestion } from './use-native-chat-composer-reply-suggestion'
import { useNativeChatReplySuggestion } from './use-native-chat-reply-suggestion'

vi.mock('@/store', () => ({
  useAppStore: (selector: (value: { settings: object }) => unknown) => selector({ settings: {} })
}))

// Every provider's suggestion rides the same host cache and frames; only its source differs
// (Claude predicts for itself, the others are asked of a model), so one lifecycle covers all.
const PROVIDERS = ['claude', 'codex', 'gentle-shell', 'pi', 'antigravity'] as const
const SOURCES = ['native', 'emulated'] as const

let counter = 0

function setup(provider: string, source: NativeChatReplySuggestion['source']) {
  counter += 1
  const sessionId = `${provider}_session_${counter}`
  const suggestion: NativeChatReplySuggestion = { turnId: 'turn-1', text: 'Run the tests', source }
  const input: NativeChatComposerInput = {
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    disabled: false,
    setSelectionRange: vi.fn(),
    select: vi.fn(),
    focus: vi.fn()
  }
  const view = renderHook(
    (props: { suggestion: NativeChatReplySuggestion | null; draft: string }) => {
      const offered = useNativeChatReplySuggestion({
        sessionId,
        suggestion: props.suggestion,
        idle: true
      })
      return useNativeChatComposerReplySuggestion({
        offered,
        draft: props.draft,
        inputBusy: false,
        textareaRef: { current: input },
        setDraft: vi.fn(),
        setCaret: vi.fn()
      })
    },
    { initialProps: { suggestion, draft: '' } }
  )
  return { ...view, suggestion }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe.each(PROVIDERS)('%s chat reply suggestion', (provider) => {
  describe.each(SOURCES)('from a %s source', (source) => {
    it('hides while typing and shows the same cached suggestion once the draft is cleared', () => {
      const { result, rerender, suggestion } = setup(provider, source)
      expect(result.current?.text).toBe('Run the tests')
      rerender({ suggestion, draft: 'my own message' })
      expect(result.current).toBeNull()
      rerender({ suggestion, draft: '' })
      expect(result.current?.text).toBe('Run the tests')
    })

    it('stays hidden after Esc, even once typed text is cleared', () => {
      const { result, rerender, suggestion } = setup(provider, source)
      act(() => result.current?.dismiss())
      expect(result.current).toBeNull()
      rerender({ suggestion, draft: 'typed' })
      rerender({ suggestion, draft: '' })
      expect(result.current).toBeNull()
    })

    it('returns after the accepted text is cleared without sending it', () => {
      const { result, rerender, suggestion } = setup(provider, source)
      act(() => result.current?.accept())
      rerender({ suggestion, draft: 'Run the tests' })
      expect(result.current).toBeNull()
      rerender({ suggestion, draft: '' })
      expect(result.current?.text).toBe('Run the tests')
    })

    it('is replaced by the next turn suggestion, dismissed or not', () => {
      const { result, rerender, suggestion } = setup(provider, source)
      act(() => result.current?.dismiss())
      rerender({
        suggestion: { ...suggestion, turnId: 'turn-2', text: 'Commit it' },
        draft: ''
      })
      expect(result.current?.text).toBe('Commit it')
    })
  })
})
