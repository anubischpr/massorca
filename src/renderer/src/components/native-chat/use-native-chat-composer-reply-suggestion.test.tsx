// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NativeChatComposerInput } from './native-chat-composer-input'
import { useNativeChatComposerReplySuggestion } from './use-native-chat-composer-reply-suggestion'

function setup(draft: string, inputBusy = false, withSuggestion = true) {
  const offered = withSuggestion ? { text: 'Run the tests', dismiss: vi.fn() } : null
  const input: NativeChatComposerInput = {
    value: '',
    selectionStart: 0,
    selectionEnd: 0,
    disabled: false,
    setSelectionRange: vi.fn(),
    select: vi.fn(),
    focus: vi.fn()
  }
  const setDraft = vi.fn()
  const setCaret = vi.fn()
  const view = renderHook(
    (props: { draft: string }) =>
      useNativeChatComposerReplySuggestion({
        offered,
        draft: props.draft,
        inputBusy,
        textareaRef: { current: input },
        setDraft,
        setCaret
      }),
    { initialProps: { draft } }
  )
  return { ...view, offered, input, setDraft, setCaret }
}

describe('useNativeChatComposerReplySuggestion', () => {
  it('offers the text over an empty draft', () => {
    expect(setup('').result.current?.text).toBe('Run the tests')
  })

  it('hides while the user types and offers the same suggestion again once the draft is empty', () => {
    const { result, rerender, offered } = setup('')
    rerender({ draft: 'my own message' })
    expect(result.current).toBeNull()
    rerender({ draft: '' })
    expect(result.current?.text).toBe('Run the tests')
    expect(offered?.dismiss).not.toHaveBeenCalled()
  })

  it('offers nothing with no suggestion, or while attachments, a picker or a disabled input own it', () => {
    expect(setup('', false, false).result.current).toBeNull()
    expect(setup('', true).result.current).toBeNull()
  })

  it('accepting puts the text in the draft with the caret after it, and spends nothing', () => {
    const { result, input, setDraft, setCaret, offered } = setup('')
    act(() => result.current?.accept())
    expect(input.value).toBe('Run the tests')
    expect(input.setSelectionRange).toHaveBeenCalledWith(13, 13)
    expect(setDraft).toHaveBeenCalledWith('Run the tests')
    expect(setCaret).toHaveBeenCalledWith(13)
    expect(offered?.dismiss).not.toHaveBeenCalled()
  })

  it('dismissing spends the suggestion without touching the draft', () => {
    const { result, setDraft, offered } = setup('')
    act(() => result.current?.dismiss())
    expect(offered?.dismiss).toHaveBeenCalledTimes(1)
    expect(setDraft).not.toHaveBeenCalled()
  })
})
