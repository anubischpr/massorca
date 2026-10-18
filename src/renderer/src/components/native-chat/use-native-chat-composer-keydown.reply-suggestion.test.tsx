// @vitest-environment happy-dom

import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { KeyboardEventHandler } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ComposerAutocomplete } from './native-chat-composer-state'
import { useNativeChatComposerKeyDown } from './use-native-chat-composer-keydown'

const NO_PICKER: ComposerAutocomplete = { mode: 'none' }

function setup(autocomplete: ComposerAutocomplete = NO_PICKER, withSuggestion = true) {
  const replySuggestion = { accept: vi.fn(), dismiss: vi.fn() }
  const callbacks = {
    completeMention: vi.fn(),
    completePickerItem: vi.fn(),
    dispatchPickerCommand: vi.fn(),
    dismissPicker: vi.fn(),
    interrupt: vi.fn(),
    send: vi.fn(),
    setActiveSuggestion: vi.fn(),
    setDraft: vi.fn(),
    setCaret: vi.fn()
  }
  const { result } = renderHook(() =>
    useNativeChatComposerKeyDown({
      autocomplete,
      mentionFiles: { files: [], loading: false, failed: false },
      activeSuggestion: 0,
      draft: '',
      isComposing: () => false,
      replySuggestion: withSuggestion ? replySuggestion : null,
      ...callbacks
    })
  )
  return { handler: result.current, replySuggestion, callbacks }
}

/** True when the handler claimed the key by preventing its default. */
function press(
  handler: KeyboardEventHandler<HTMLElement>,
  key: string,
  modifiers: Partial<Record<'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey', boolean>> = {}
): boolean {
  const view = render(<div data-testid="composer" onKeyDown={handler} />)
  const defaultPrevented = !fireEvent.keyDown(screen.getByTestId('composer'), { key, ...modifiers })
  view.unmount()
  return defaultPrevented
}

describe('reply suggestion keys', () => {
  it('Tab takes the suggestion into the draft without sending', () => {
    const { handler, replySuggestion, callbacks } = setup()
    expect(press(handler, 'Tab')).toBe(true)
    expect(replySuggestion.accept).toHaveBeenCalledTimes(1)
    expect(callbacks.send).not.toHaveBeenCalled()
  })

  it('Esc dismisses the suggestion instead of interrupting', () => {
    const { handler, replySuggestion, callbacks } = setup()
    press(handler, 'Escape')
    expect(replySuggestion.dismiss).toHaveBeenCalledTimes(1)
    expect(callbacks.interrupt).not.toHaveBeenCalled()
  })

  it('leaves modified Tab to the browser, so focus can still leave the composer', () => {
    const { handler, replySuggestion } = setup()
    expect(press(handler, 'Tab', { shiftKey: true })).toBe(false)
    expect(replySuggestion.accept).not.toHaveBeenCalled()
    press(handler, 'Tab', { ctrlKey: true })
    expect(replySuggestion.accept).not.toHaveBeenCalled()
  })

  it('does nothing special without a suggestion: Esc interrupts, Tab is untouched', () => {
    const { handler, callbacks } = setup(NO_PICKER, false)
    expect(press(handler, 'Tab')).toBe(false)
    press(handler, 'Escape')
    expect(callbacks.interrupt).toHaveBeenCalledTimes(1)
  })

  it('yields Tab and Esc to an open picker', () => {
    const mention: ComposerAutocomplete = { mode: 'mention', query: 'a', triggerKey: '@:0' }
    const { handler, replySuggestion, callbacks } = setup(mention)
    press(handler, 'Escape')
    expect(replySuggestion.dismiss).not.toHaveBeenCalled()
    expect(callbacks.dismissPicker).toHaveBeenCalledTimes(1)
  })
})
