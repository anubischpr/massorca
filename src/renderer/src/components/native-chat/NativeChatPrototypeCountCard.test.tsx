// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NativeChatPrototypeCountCard } from './NativeChatPrototypeCountCard'
import type { NativeChatPrototypeAsk } from './native-chat-prototype-request-store'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => options?.[name] ?? '')
}))

function ask(overrides: Partial<NativeChatPrototypeAsk> = {}): NativeChatPrototypeAsk {
  return {
    text: 'Make a mockup of the pricing page',
    attachments: [],
    sentFrom: { text: 'Make a mockup of the pricing page', images: [] },
    keyword: false,
    settingAsks: true,
    defaultCount: 2,
    agentName: 'Codex',
    ...overrides
  }
}

describe('NativeChatPrototypeCountCard', () => {
  afterEach(cleanup)

  it('asks how many prototypes, naming the agent, with 1, 2 and 3', () => {
    render(<NativeChatPrototypeCountCard ask={ask()} onChoose={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'How many prototypes?' })).toBeInTheDocument()
    expect(
      screen.getByText('Codex will make distinct directions so you can compare them.')
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '1',
      '2',
      '3'
    ])
  })

  it('fills the button of the default count and outlines the others', () => {
    render(<NativeChatPrototypeCountCard ask={ask({ defaultCount: 3 })} onChoose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('data-variant', 'default')
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('data-variant', 'outline')
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('data-variant', 'outline')
  })

  it('answers with the picked count', async () => {
    const onChoose = vi.fn()
    render(<NativeChatPrototypeCountCard ask={ask()} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    expect(onChoose).toHaveBeenCalledExactlyOnceWith({ count: 3 })
  })

  it('offers "Not a prototype" for a keyword match only, and it sends the text as typed', async () => {
    const onChoose = vi.fn()
    const { rerender } = render(
      <NativeChatPrototypeCountCard ask={ask({ keyword: false })} onChoose={onChoose} />
    )
    expect(screen.queryByRole('button', { name: 'Not a prototype' })).not.toBeInTheDocument()
    rerender(<NativeChatPrototypeCountCard ask={ask({ keyword: true })} onChoose={onChoose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Not a prototype' }))
    expect(onChoose).toHaveBeenCalledExactlyOnceWith('as-typed')
  })

  it('says why it appeared only when Settings asks each time', () => {
    const { rerender } = render(
      <NativeChatPrototypeCountCard ask={ask({ settingAsks: true })} onChoose={vi.fn()} />
    )
    expect(
      screen.getByText('Shown because Settings › Prototypes is “Ask each time”.')
    ).toBeInTheDocument()
    rerender(<NativeChatPrototypeCountCard ask={ask({ settingAsks: false })} onChoose={vi.fn()} />)
    expect(screen.queryByText(/Shown because/)).not.toBeInTheDocument()
  })
})
