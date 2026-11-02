/**
 * @vitest-environment happy-dom
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }: { children?: ReactNode }) => children,
  ContextMenuContent: ({ children }: { children?: ReactNode }) => <div role="menu">{children}</div>,
  ContextMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) => (
    <button type="button" role="menuitem" onClick={onSelect}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <hr />
}))
vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  translate: (_key: string, fallback: string) => fallback
}))

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('@/store', () => ({ useAppStore: store }))
vi.mock('../../store', () => ({ useAppStore: store }))

const { OneLineSessionMenu } = await import('./worktree-card-one-line-session-menu')

const A = 'repo::/work/a'
const B = 'repo::/work/b'
const mounted: { container: HTMLDivElement; root: Root }[] = []

function chat(id: string, worktreeId: string, groupId: string) {
  return makeUnifiedTab({ id, worktreeId, groupId, contentType: 'agent-session', label: id })
}

function agentRow(tabId: string, worktreeId: string, crossWorktree = false): DashboardAgentRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial fixture; the menu reads only these fields.
  return {
    paneKey: `${tabId}:pane`,
    tab: { id: tabId, worktreeId },
    agentType: 'claude',
    state: 'idle',
    rowSource: 'live',
    crossWorktree,
    entry: { prompt: 'task', state: 'idle', stateStartedAt: 1, paneKey: `${tabId}:pane` }
  } as unknown as DashboardAgentRow
}

function openMenu(agent: DashboardAgentRow): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <OneLineSessionMenu agent={agent} title="title" onStartRename={() => {}}>
        <button type="button">row</button>
      </OneLineSessionMenu>
    )
  )
  return container
}

function splitViewItem(container: HTMLElement): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')].find(
    (button) => button.textContent === 'Split view'
  )
}

beforeEach(() => {
  seedStore(store, {
    activeView: 'terminal',
    activeWorktreeId: A,
    paneFocus: null,
    unifiedTabsByWorktree: {
      [A]: [chat('a-one', A, 'a-main'), chat('a-two', A, 'a-main')],
      [B]: [chat('b-chat', B, 'b-main')]
    },
    groupsByWorktree: {
      [A]: [
        makeTabGroup({
          id: 'a-main',
          worktreeId: A,
          tabOrder: ['a-one', 'a-two'],
          activeTabId: 'a-one'
        })
      ],
      [B]: [
        makeTabGroup({ id: 'b-main', worktreeId: B, tabOrder: ['b-chat'], activeTabId: 'b-chat' })
      ]
    },
    activeGroupIdByWorktree: { [A]: 'a-main', [B]: 'b-main' },
    layoutByWorktree: {
      [A]: { type: 'leaf', groupId: 'a-main' },
      [B]: { type: 'leaf', groupId: 'b-main' }
    }
  })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('the session menu’s Split view', () => {
  it('opens a session that is not in focus beside the focused one', () => {
    const container = openMenu(agentRow('a-two', A))
    const item = splitViewItem(container)
    expect(item).toBeDefined()
    act(() => item?.click())
    const pane = store.getState().groupsByWorktree[A].find((group) => group.id !== 'a-main')
    expect(pane?.tabOrder).toEqual(['a-two'])
    expect(store.getState().activeGroupIdByWorktree[A]).toBe(pane?.id)
  })

  it('opens another worktree’s session listed in the sidebar, by reference', () => {
    const container = openMenu(agentRow('b-chat', B, true))
    act(() => splitViewItem(container)?.click())
    const pane = store.getState().groupsByWorktree[A].find((group) => group.id !== 'a-main')
    expect(pane?.sessionRef).toEqual({ worktreeId: B, tabId: 'b-chat' })
  })

  it('is not offered on the focused session', () => {
    expect(splitViewItem(openMenu(agentRow('a-one', A)))).toBeUndefined()
  })

  it('keeps the rest of the menu as it was', () => {
    const labels = [...openMenu(agentRow('a-one', A)).querySelectorAll('[role="menuitem"]')].map(
      (item) => item.textContent
    )
    expect(labels).toEqual(['Rename', 'Mark Read', 'Copy Title', 'Copy Path', 'Close'])
  })
})
