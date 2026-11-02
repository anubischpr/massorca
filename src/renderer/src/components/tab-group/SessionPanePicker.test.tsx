/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('../tab-bar/web-runtime-tab-move-mirror', () => ({ mirrorWebRuntimeTabMove: vi.fn() }))

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('../../store', () => ({ useAppStore: store }))

const { SessionPanePicker } = await import('./SessionPanePicker')

const WT = 'repo::/work/a'
const mounted: { container: HTMLDivElement; root: Root }[] = []

function mount(groupId: string): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<SessionPanePicker worktreeId={WT} groupId={groupId} />))
  return container
}

const button = (container: ParentNode, name: string): HTMLButtonElement => {
  const found = [...container.querySelectorAll('button')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name
  )
  if (!found) {
    throw new Error(`Button ${name} missing`)
  }
  return found
}

function session(id: string, groupId: string, label: string) {
  return makeUnifiedTab({ id, worktreeId: WT, groupId, contentType: 'agent-session', label })
}

beforeEach(() => {
  seedStore(store, {
    activeWorktreeId: WT,
    unifiedTabsByWorktree: {
      [WT]: [
        session('A', 'main', 'Fix the login redirect'),
        session('B', 'main', 'Write the release notes')
      ]
    },
    groupsByWorktree: {
      [WT]: [
        makeTabGroup({ id: 'main', worktreeId: WT, tabOrder: ['A', 'B'], activeTabId: 'A' }),
        makeTabGroup({ id: 'pane2', worktreeId: WT, tabOrder: [], activeTabId: null })
      ]
    },
    activeGroupIdByWorktree: { [WT]: 'pane2' },
    layoutByWorktree: {
      [WT]: {
        type: 'split',
        direction: 'horizontal',
        first: { type: 'leaf', groupId: 'main' },
        second: { type: 'leaf', groupId: 'pane2' }
      }
    }
  })
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('SessionPanePicker', () => {
  it('lists the sessions that are not on screen, with Create and Close split pane beside them', () => {
    const container = mount('pane2')
    const labels = [...container.querySelectorAll('button')].map(
      (candidate) => candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()
    )
    expect(labels).toEqual(['Write the release notes', 'Create', 'Close split pane'])
  })

  it('puts the chosen session in this pane', () => {
    const container = mount('pane2')
    act(() => button(container, 'Write the release notes').click())
    const groups = store.getState().groupsByWorktree[WT]
    expect(groups.find((group) => group.id === 'pane2')?.tabOrder).toEqual(['B'])
    expect(groups.find((group) => group.id === 'main')?.tabOrder).toEqual(['A'])
  })

  it('closes the pane with the mouse and leaves every session where it was', () => {
    const container = mount('pane2')
    act(() => button(container, 'Close split pane').click())
    const state = store.getState()
    expect(state.groupsByWorktree[WT].map((group) => group.id)).toEqual(['main'])
    expect(state.layoutByWorktree[WT]).toEqual({ type: 'leaf', groupId: 'main' })
    expect(state.groupsByWorktree[WT][0].tabOrder).toEqual(['A', 'B'])
  })

  it('starts a new session from Create', () => {
    const container = mount('pane2')
    act(() => button(container, 'Create').click())
    expect(store.getState().activeView).toBe('create-chat')
  })

  it('offers only Create and Close split pane when the one session is already on screen', () => {
    seedStore(store, {
      unifiedTabsByWorktree: { [WT]: [session('A', 'main', 'Fix the login redirect')] },
      groupsByWorktree: {
        [WT]: [
          makeTabGroup({ id: 'main', worktreeId: WT, tabOrder: ['A'], activeTabId: 'A' }),
          makeTabGroup({ id: 'pane2', worktreeId: WT, tabOrder: [], activeTabId: null })
        ]
      }
    })
    const container = mount('pane2')
    expect(
      [...container.querySelectorAll('button')].map(
        (b) => b.getAttribute('aria-label') ?? b.textContent?.trim()
      )
    ).toEqual(['Create', 'Close split pane'])
  })
})
