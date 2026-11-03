import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../../store/slices/store-test-helpers')
const store = createTestStore()
vi.mock('../../store', () => ({ useAppStore: store }))

const { canOpenSessionInSplitView, openSessionInSplitView } = await import('./session-split-view')

const A = 'repo::/work/a'
const B = 'repo::/work/b'

function chat(id: string, worktreeId: string, groupId: string) {
  return makeUnifiedTab({ id, worktreeId, groupId, contentType: 'agent-session', label: id })
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

function paneIds(worktreeId: string): string[] {
  return (store.getState().groupsByWorktree[worktreeId] ?? []).map((group) => group.id)
}

describe('Split view from a session’s menu', () => {
  it('is offered for a session that is not on screen, and not for the focused one', () => {
    const state = store.getState()
    expect(canOpenSessionInSplitView(state, { worktreeId: A, tabId: 'a-two' })).toBe(true)
    expect(canOpenSessionInSplitView(state, { worktreeId: B, tabId: 'b-chat' })).toBe(true)
    expect(canOpenSessionInSplitView(state, { worktreeId: A, tabId: 'a-one' })).toBe(false)
  })

  it('opens a session of the same workspace beside the focused one, and focuses it', () => {
    expect(openSessionInSplitView({ worktreeId: A, tabId: 'a-two' })).toBe(true)
    const state = store.getState()
    const pane = state.groupsByWorktree[A].find((group) => group.id !== 'a-main')
    expect(pane?.tabOrder).toEqual(['a-two'])
    expect(state.groupsByWorktree[A].find((group) => group.id === 'a-main')?.activeTabId).toBe(
      'a-one'
    )
    expect(state.layoutByWorktree[A]).toMatchObject({
      type: 'split',
      direction: 'horizontal',
      first: { groupId: 'a-main' },
      second: { groupId: pane?.id }
    })
    expect(state.activeGroupIdByWorktree[A]).toBe(pane?.id)
    expect(state.activeWorktreeId).toBe(A)
  })

  it('shows another workspace’s session by reference, and the focus follows it', () => {
    expect(openSessionInSplitView({ worktreeId: B, tabId: 'b-chat' })).toBe(true)
    const state = store.getState()
    const pane = state.groupsByWorktree[A].find((group) => group.id !== 'a-main')
    expect(pane?.sessionRef).toEqual({ worktreeId: B, tabId: 'b-chat' })
    expect(state.groupsByWorktree[B].map((group) => group.tabOrder)).toEqual([['b-chat']])
    expect(state.paneFocus).toEqual({ layoutWorktreeId: A, ownerWorktreeId: B, groupId: pane?.id })
  })

  it('is not offered again for a session a pane already shows', () => {
    openSessionInSplitView({ worktreeId: B, tabId: 'b-chat' })
    expect(canOpenSessionInSplitView(store.getState(), { worktreeId: B, tabId: 'b-chat' })).toBe(
      false
    )
  })

  it('brings the workspaces back on screen when opened from another page', () => {
    seedStore(store, { activeView: 'tasks' })
    expect(openSessionInSplitView({ worktreeId: A, tabId: 'a-two' })).toBe(true)
    expect(store.getState().activeView).toBe('terminal')
  })

  it('leaves no empty pane behind when the session cannot be shown', () => {
    expect(openSessionInSplitView({ worktreeId: A, tabId: 'gone' })).toBe(false)
    expect(paneIds(A)).toEqual(['a-main'])
  })
})
