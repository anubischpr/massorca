/**
 * @vitest-environment happy-dom
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NativeChatStructuredPaneHeader } from './NativeChatStructuredPaneHeader'
import type { StructuredChatTerminalViewState } from './structured-chat-terminal-view'

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => children,
  TooltipContent: ({ children }: { children?: ReactNode }) => <span>{children}</span>
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

const ENABLED: StructuredChatTerminalViewState = {
  enabled: true,
  launch: {
    mode: 'resume',
    agent: 'claude',
    providerSession: { key: 'session_id', id: 'session-1' }
  }
}

function render(props: Partial<Parameters<typeof NativeChatStructuredPaneHeader>[0]> = {}) {
  const handlers = {
    onHandOff: vi.fn(),
    onShowTerminal: vi.fn(),
    onSplitRight: vi.fn(),
    onClose: vi.fn()
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <NativeChatStructuredPaneHeader canHandOff terminalView={ENABLED} {...handlers} {...props} />
    )
  )
  return { container, handlers }
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!found) {
    throw new Error(`Missing header action: ${label}`)
  }
  return found
}

describe('NativeChatStructuredPaneHeader', () => {
  it('renders the four pane actions with the terminal pane labels', () => {
    const { container } = render()
    for (const label of [
      'Hand Off to Another Agent',
      'Show terminal',
      'Split Terminal Right',
      'Close tab'
    ]) {
      expect(button(container, label)).toBeTruthy()
    }
  })

  it('routes each action to its own handler', () => {
    const { container, handlers } = render()
    act(() => button(container, 'Hand Off to Another Agent').click())
    act(() => button(container, 'Show terminal').click())
    act(() => button(container, 'Split Terminal Right').click())
    act(() => button(container, 'Close tab').click())
    expect(handlers.onHandOff).toHaveBeenCalledTimes(1)
    expect(handlers.onShowTerminal).toHaveBeenCalledTimes(1)
    expect(handlers.onSplitRight).toHaveBeenCalledTimes(1)
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
  })

  it('disables the terminal view with the reason it is unavailable', () => {
    const { container, handlers } = render({
      terminalView: { enabled: false, reason: 'no-provider-session' }
    })
    const toggle = button(container, 'Show terminal')
    expect(toggle.disabled).toBe(true)
    expect(container.textContent).toContain(
      "This chat's agent session cannot be opened in the terminal."
    )
    act(() => toggle.click())
    expect(handlers.onShowTerminal).not.toHaveBeenCalled()
  })

  it('disables hand-off for an agent that cannot start a new session', () => {
    const { container, handlers } = render({ canHandOff: false })
    const handOff = button(container, 'Hand Off to Another Agent')
    expect(handOff.disabled).toBe(true)
    expect(container.textContent).toContain('This agent cannot start a new session from its chat.')
    act(() => handOff.click())
    expect(handlers.onHandOff).not.toHaveBeenCalled()
  })
})
