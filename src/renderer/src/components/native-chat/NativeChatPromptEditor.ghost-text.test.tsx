// @vitest-environment happy-dom
import { createRef } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NativeChatPromptEditor } from './NativeChatPromptEditor'
import type { NativeChatComposerInput } from './native-chat-composer-input'

afterEach(cleanup)

function setup(ghostText: string | null) {
  const inputRef = createRef<NativeChatComposerInput>()
  const view = render(
    <NativeChatPromptEditor
      inputRef={inputRef}
      initialValue=""
      disabled={false}
      placeholder="Message"
      ghostText={ghostText}
      onChange={vi.fn()}
      onSelect={vi.fn()}
    />
  )
  const shown = (): string | null =>
    view.container.querySelector('p.is-editor-empty')?.getAttribute('data-placeholder') ?? null
  return {
    ...view,
    shown,
    input: () => inputRef.current!,
    rerenderWith: (next: string | null) =>
      view.rerender(
        <NativeChatPromptEditor
          inputRef={inputRef}
          initialValue=""
          disabled={false}
          placeholder="Message"
          ghostText={next}
          onChange={vi.fn()}
          onSelect={vi.fn()}
        />
      )
  }
}

describe('prompt editor ghost text', () => {
  it('shows the suggestion in the empty editor and keeps the real label for assistive tech', () => {
    const { shown } = setup('Run the tests')
    expect(shown()).toBe('Run the tests')
    expect(screen.getByRole('textbox').getAttribute('aria-label')).toBe('Message')
  })

  it('falls back to the placeholder with no suggestion', () => {
    const { shown } = setup(null)
    expect(shown()).toBe('Message')
  })

  it('updates when the suggestion appears or goes away', () => {
    const { shown, rerenderWith } = setup(null)
    rerenderWith('Next step')
    expect(shown()).toBe('Next step')
    rerenderWith(null)
    expect(shown()).toBe('Message')
  })

  it('hides while there is text and returns for the same suggestion once it is cleared', () => {
    const { shown, input } = setup('Run the tests')
    act(() => {
      input().value = 'my own message'
    })
    expect(shown()).toBeNull()
    act(() => {
      input().value = ''
    })
    expect(shown()).toBe('Run the tests')
  })
})
