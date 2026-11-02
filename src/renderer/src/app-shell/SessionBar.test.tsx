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

const { createTestStore, makeTabGroup, makeUnifiedTab, makeWorktree, seedStore } =
  await import('../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('../store', () => ({ useAppStore: store }))

const { SessionBar } = await import('./SessionBar')
const { useSessionBarActionsTarget } = await import('./session-bar-slot')
const { TOP_BAR_SURFACE_CLASS } = await import('./top-bar-surface')
const { selectSidePanelOpen } = await import('../store/slices/tabs/side-panel-state')

const WT = 'repo::/work/a'
const mounted: { container: HTMLDivElement; root: Root }[] = []

function SessionActions(): React.JSX.Element | null {
  const target = useSessionBarActionsTarget()
  return target ? createPortal(<button aria-label="Split Terminal Right" />, target) : null
}

function mountBar(
  reserveWindowControls = false,
  collapsePane: { tabId: string; canExpand: boolean } | null = null
): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <>
        <SessionBar
          worktreeId={WT}
          reserveWindowControls={reserveWindowControls}
          collapsePane={collapsePane}
        />
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
    expect(selectSidePanelOpen(store.getState(), WT)).toBe(true)
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

  it('shows Collapse pane only while a pane is expanded, and sends the toggle for that tab', () => {
    expect(mountBar().querySelector('button[aria-label="Collapse pane"]')).toBeNull()
    const seen: string[] = []
    const listener = (event: Event): void => {
      seen.push((event as CustomEvent<{ tabId: string }>).detail.tabId)
    }
    window.addEventListener('orca-toggle-terminal-pane-expand', listener)
    const container = mountBar(false, { tabId: 'term-1', canExpand: true })
    const button = container.querySelector<HTMLButtonElement>('button[aria-label="Collapse pane"]')
    act(() => button?.click())
    window.removeEventListener('orca-toggle-terminal-pane-expand', listener)
    expect(seen).toEqual(['term-1'])
  })

  it('disables Collapse pane when the active tab cannot expand', () => {
    const container = mountBar(false, { tabId: 'term-1', canExpand: false })
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Collapse pane"]')?.disabled
    ).toBe(true)
  })

  it('names the bar after the workspace while the main area has no session', () => {
    seedStore(store, {
      unifiedTabsByWorktree: { [WT]: [] },
      groupsByWorktree: { [WT]: [] },
      layoutByWorktree: {},
      worktreesByRepo: {
        repo1: [makeWorktree({ id: WT, repoId: 'repo1', displayName: 'verify-secondary' })]
      }
    })
    const container = mountBar()
    expect(container.querySelector('[data-session-bar]')?.firstElementChild?.textContent).toBe(
      'verify-secondary'
    )
  })

  it('keeps the floating sidebar header clickable: its spot is a no-drag island inside the bar', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    mounted.push({ container, root })
    act(() =>
      root.render(
        <SessionBar worktreeId={WT} reserveWindowControls={false} reserveCollapsedSidebarHeader />
      )
    )
    const island = container.querySelector<HTMLElement>(
      '[data-session-bar] [data-sidebar-header-island]'
    )
    expect(island?.className).toContain('[-webkit-app-region:no-drag]')
    expect(island?.style.width).toContain('--collapsed-sidebar-header-width')
  })

  it('has no such island while the sidebar header is not floating over it', () => {
    expect(mountBar().querySelector('[data-sidebar-header-island]')).toBeNull()
  })
})

describe('SessionBar surface', () => {
  it('is the same grey as every other top bar, not the page background', () => {
    const bar = mountBar().querySelector<HTMLElement>('header[data-session-bar]')
    for (const token of TOP_BAR_SURFACE_CLASS.split(' ')) {
      expect(bar?.className).toContain(token)
    }
    expect(bar?.className).not.toContain('bg-background')
  })
})

describe('SessionBar closing a split pane', () => {
  function splitInto(activeGroup: 'main' | 'pane2') {
    seedStore(store, {
      unifiedTabsByWorktree: {
        [WT]: [
          makeUnifiedTab({
            id: 'chat',
            worktreeId: WT,
            groupId: 'main',
            contentType: 'agent-session',
            label: 'First'
          }),
          makeUnifiedTab({
            id: 'chat2',
            worktreeId: WT,
            groupId: 'pane2',
            contentType: 'agent-session',
            label: 'Second'
          })
        ]
      },
      groupsByWorktree: {
        [WT]: [
          makeTabGroup({ id: 'main', worktreeId: WT, tabOrder: ['chat'], activeTabId: 'chat' }),
          makeTabGroup({ id: 'pane2', worktreeId: WT, tabOrder: ['chat2'], activeTabId: 'chat2' })
        ]
      },
      activeGroupIdByWorktree: { [WT]: activeGroup },
      layoutByWorktree: {
        [WT]: {
          type: 'split',
          direction: 'horizontal',
          first: { type: 'leaf', groupId: 'main' },
          second: { type: 'leaf', groupId: 'pane2' }
        }
      }
    })
  }

  it('has no Close split pane button while there is one pane', () => {
    expect(mountBar().querySelector('button[aria-label="Close split pane"]')).toBeNull()
  })

  it('closes the focused pane from a mouse button and keeps every session', () => {
    splitInto('pane2')
    const close = mountBar().querySelector<HTMLButtonElement>(
      'button[aria-label="Close split pane"]'
    )
    expect(close).not.toBeNull()
    act(() => close?.click())
    const state = store.getState()
    expect(state.groupsByWorktree[WT].map((group) => group.id)).toEqual(['main'])
    expect(state.groupsByWorktree[WT][0].tabOrder).toEqual(['chat', 'chat2'])
    expect(state.layoutByWorktree[WT]).toEqual({ type: 'leaf', groupId: 'main' })
  })
})
