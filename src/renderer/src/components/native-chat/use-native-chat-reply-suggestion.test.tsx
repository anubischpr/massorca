// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeChatReplySuggestion } from '../../../../shared/native-chat-reply-suggestion'
import { useNativeChatReplySuggestion } from './use-native-chat-reply-suggestion'

type TestSettings = {
  nativeChatReplySuggestions?: boolean
  nativeChatEmulatedReplySuggestions?: boolean
}
const state = vi.hoisted((): { settings: TestSettings } => ({ settings: {} }))
vi.mock('@/store', () => ({
  useAppStore: (selector: (value: typeof state) => unknown) => selector(state)
}))

const native: NativeChatReplySuggestion = { turnId: 'turn-1', text: 'Run it', source: 'native' }
let nextSession = 0
let sessionId = ''

beforeEach(() => {
  state.settings = {}
  nextSession += 1
  sessionId = `session-${nextSession}`
})

function render(suggestion: NativeChatReplySuggestion | null, idle = true) {
  return renderHook(
    (props: { suggestion: NativeChatReplySuggestion | null; idle: boolean }) =>
      useNativeChatReplySuggestion({ sessionId, ...props }),
    { initialProps: { suggestion, idle } }
  )
}

describe('useNativeChatReplySuggestion', () => {
  it('offers the host suggestion while idle', () => {
    expect(render(native).result.current?.text).toBe('Run it')
  })

  it('offers nothing while a turn runs, and the same suggestion again once idle', () => {
    const { result, rerender } = render(native, false)
    expect(result.current).toBeNull()
    rerender({ suggestion: native, idle: true })
    expect(result.current?.text).toBe('Run it')
  })

  it('offers nothing with no suggestion', () => {
    expect(render(null).result.current).toBeNull()
  })

  it('respects the settings: off hides everything, the sub-toggle hides only emulated', () => {
    state.settings = { nativeChatReplySuggestions: false }
    expect(render(native).result.current).toBeNull()
    state.settings = { nativeChatEmulatedReplySuggestions: false }
    expect(render(native).result.current?.text).toBe('Run it')
    expect(render({ ...native, source: 'emulated' }).result.current).toBeNull()
  })

  it('stays dismissed for that turn, across a remount, and returns for a new turn', () => {
    const first = render(native)
    act(() => first.result.current?.dismiss())
    expect(first.result.current).toBeNull()
    first.unmount()

    expect(render(native).result.current).toBeNull()

    const next = render({ ...native, turnId: 'turn-2' })
    expect(next.result.current?.text).toBe('Run it')
  })
})
