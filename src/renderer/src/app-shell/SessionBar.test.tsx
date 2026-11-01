/**
 * @vitest-environment happy-dom
 */
import { act, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => children,
  TooltipContent: ({ children }: { children?: ReactNode }) => <span>{children}</span>
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('../hooks/useShortcutLabel', () => ({ useShortcutLabel: () => 'Ctrl+B' }))

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('../store', () => ({ useAppStore: store }))

const { SessionBar } = await import('./SessionBar')
const { useSessionBarActionsTarget } = await import('./session-bar-slot')

const WT = 'repo::/work/a'
const mounted: { container: HTMLDivElement; root: Root }[] = []

function SessionActions(): React.JSX.Element | null {
  const target = useSessionBarActionsTarget()
  return target ? createPortal(<button aria-label="Split Terminal Right" />, target) : null
}

function mountBar(reserveWindowControls = false): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <>
        <SessionBar worktreeId={WT} reserveWindowControls={reserveWindowControls} />
        <SessionActions />
      </>
    )
  )
  return container
}

beforeEach(() => {
  seedStore(store, {
    activeWorktreeId: WT,
    unifiedTabsByWorktree: {
      [WT]: [
        makeUnifiedTab({
          id: 'chat',
          worktreeId: WT,
          groupId: 'main',
          contentType: 'agent-session',
          label: 'Fix the login redirect'
        })
      ]
    },
    groupsByWorktree: {
      [WT]: [makeTabGroup({ id: 'main', worktreeId: WT, tabOrder: ['chat'], activeTabId: 'chat' })]
    },
    activeGroupIdByWorktree: { [WT]: 'main' },
    layoutByWorktree: { [WT]: { type: 'leaf', groupId: 'main' } },
    sidePanelOpenByWorktree: {},
    rightSidebarOpen: false
  })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('SessionBar', () => {
  it('prints the session name at the left of a 44px bar', () => {
    const container = mountBar()
    const bar = container.querySelector<HTMLElement>('[data-session-bar]')
    expect(bar?.className).toContain('h-11')
    expect(bar?.firstElementChild?.textContent).toBe('Fix the login redirect')
  })

  it('has no Close tab button', () => {
    const container = mountBar()
    expect(container.querySelector('button[aria-label="Close tab"]')).toBeNull()
  })

  it('carries the Side panel and Toggle right sidebar buttons with their state', () => {
    const container = mountBar()
    const sidePanel = container.querySelector<HTMLButtonElement>('button[aria-label="Side panel"]')
    const rightSidebar = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Toggle right sidebar"]'
    )
    expect(sidePanel?.getAttribute('aria-pressed')).toBe('false')
    expect(rightSidebar?.getAttribute('aria-pressed')).toBe('false')
    act(() => sidePanel?.click())
    expect(store.getState().sidePanelOpenByWorktree[WT]).toBe(true)
    expect(sidePanel?.getAttribute('aria-pressed')).toBe('true')
    act(() => rightSidebar?.click())
    expect(store.getState().rightSidebarOpen).toBe(true)
  })

  it('shows the session actions a pane renders into its slot', () => {
    const container = mountBar()
    expect(container.querySelector('button[aria-label="Split Terminal Right"]')).not.toBeNull()
  })

  it('keeps the bar clear of the window controls when asked', () => {
    const container = mountBar(true)
    expect(
      container.querySelector<HTMLElement>('[data-session-bar]')?.style.paddingRight
    ).toContain('--window-controls-width')
  })
})
