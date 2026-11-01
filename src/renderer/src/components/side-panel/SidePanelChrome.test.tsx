/**
 * @vitest-environment happy-dom
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SidePanelEmptyState } from './SidePanelEmptyState'
import { SidePanelTabStrip } from './SidePanelTabStrip'
import { buildSidePanelNewTabOptions } from './side-panel-new-tab-options'
import type { SidePanelTabItem } from './use-side-panel-model'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => children,
  TooltipContent: ({ children }: { children?: ReactNode }) => <span>{children}</span>
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('../../hooks/useShortcutLabel', () => ({
  useShortcutLabel: (actionId: string) =>
    actionId === 'tab.newTerminal' ? 'Ctrl+T' : 'Ctrl+Shift+B'
}))

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function mount(node: ReactNode): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(node))
  return container
}

const OPTIONS = buildSidePanelNewTabOptions(true)
const ITEMS: SidePanelTabItem[] = [
  { id: 'u1', visibleId: 't1', kind: 'terminal', label: 'Terminal 1', active: true },
  { id: 'u2', visibleId: 'b1', kind: 'browser', label: 'Docs', active: false }
]

function labelled(container: ParentNode, label: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!found) {
    throw new Error(`Missing button: ${label}`)
  }
  return found
}

describe('SidePanelTabStrip', () => {
  function render() {
    const handlers = {
      onActivate: vi.fn(),
      onClose: vi.fn(),
      onCreate: vi.fn(),
      onClosePanel: vi.fn()
    }
    const container = mount(
      <SidePanelTabStrip groupId="side-panel:wt" worktreeId="wt" items={ITEMS} newTabOptions={OPTIONS} {...handlers} />
    )
    return { container, handlers }
  }

  it('shows each tab with its label and marks the active one', () => {
    const { container } = render()
    const tabs = [...container.querySelectorAll('[role="tab"]')]
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Terminal 1', 'Docs'])
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false'])
  })

  it('activates a tab on click and closes it from its own X', () => {
    const { container, handlers } = render()
    act(() => (container.querySelectorAll('[role="tab"]')[1] as HTMLElement).click())
    expect(handlers.onActivate).toHaveBeenCalledWith('u2')
    const closeButtons = container.querySelectorAll('button[aria-label="Close tab"]')
    expect(closeButtons).toHaveLength(2)
    act(() => (closeButtons[0] as HTMLElement).click())
    expect(handlers.onClose).toHaveBeenCalledWith('u1')
  })

  it('exposes each tab to automation by its visible id and active state', () => {
    const { container } = render()
    const rows = [...container.querySelectorAll('[data-testid="side-panel-tab"]')]
    expect(rows.map((row) => row.getAttribute('data-tab-id'))).toEqual(['t1', 'b1'])
    expect(rows.map((row) => row.getAttribute('data-active'))).toEqual(['true', 'false'])
  })

  it('closes the whole panel from Close panel', () => {
    const { container, handlers } = render()
    act(() => labelled(container, 'Close panel').click())
    expect(handlers.onClosePanel).toHaveBeenCalledTimes(1)
  })

  it('lists exactly the four creatable kinds in the + menu and creates the chosen one', () => {
    const { handlers } = render()
    const trigger = labelled(document.body, 'New tab')
    act(() => {
      trigger.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
      )
    })
    const items = [...document.querySelectorAll('[role="menuitem"]')]
    expect(items.map((item) => item.textContent)).toEqual([
      'New TerminalCtrl+T',
      'New Browser TabCtrl+Shift+B',
      'New Markdown',
      'New Mobile Emulator'
    ])
    act(() => (items[1] as HTMLElement).click())
    expect(handlers.onCreate).toHaveBeenCalledWith('new-browser')
  })
})

describe('SidePanelEmptyState', () => {
  it('offers the four ways to start a tab as buttons and nothing else', () => {
    const onCreate = vi.fn()
    const container = mount(<SidePanelEmptyState options={OPTIONS} onCreate={onCreate} />)
    const buttons = [...container.querySelectorAll('button')]
    expect(buttons.map((button) => button.textContent)).toEqual([
      'New Terminal',
      'New Browser Tab',
      'New Markdown',
      'New Mobile Emulator'
    ])
    act(() => buttons[3].click())
    expect(onCreate).toHaveBeenCalledWith('new-simulator')
  })
})
