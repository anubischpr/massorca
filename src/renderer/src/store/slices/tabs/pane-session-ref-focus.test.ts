import { beforeEach, describe, expect, it } from 'vitest'
import { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } from '../store-test-helpers'
import { selectLayoutWorktreeId, selectSidePanelWorktreeId } from './pane-session-ref'

const A = 'repo::/work/a'
const B = 'repo::/work/b'
const store = createTestStore()

function chat(id: string, worktreeId: string, groupId: string) {
  return makeUnifiedTab({ id, worktreeId, groupId, contentType: 'agent-session', label: id })
}

beforeEach(() => {
  seedStore(store, {
    activeWorktreeId: A,
    paneFocus: null,
    unifiedTabsByWorktree: {
      [A]: [chat('a-chat', A, 'a-main')],
      [B]: [chat('b-chat', B, 'b-main')]
    },
    groupsByWorktree: {
      [A]: [
        makeTabGroup({ id: 'a-main', worktreeId: A, tabOrder: ['a-chat'], activeTabId: 'a-chat' }),
        {
          ...makeTabGroup({ id: 'a-pane', worktreeId: A, tabOrder: [], activeTabId: null }),
          sessionRef: { worktreeId: B, tabId: 'b-chat' }
        }
      ],
      [B]: [
        makeTabGroup({ id: 'b-main', worktreeId: B, tabOrder: ['b-chat'], activeTabId: 'b-chat' })
      ]
    },
    activeGroupIdByWorktree: { [A]: 'a-main', [B]: 'b-main' },
    layoutByWorktree: {
      [A]: {
        type: 'split',
        direction: 'horizontal',
        first: { type: 'leaf', groupId: 'a-main' },
        second: { type: 'leaf', groupId: 'a-pane' }
      },
      [B]: { type: 'leaf', groupId: 'b-main' }
    }
  })
})

describe('focusing a pane that shows another workspace’s session', () => {
  it('follows the workspace that owns the session, while the pane’s own layout stays on screen', () => {
    store.getState().focusGroup(A, 'a-pane')
    const state = store.getState()
    expect(state.activeWorktreeId).toBe(B)
    expect(state.activeGroupIdByWorktree[B]).toBe('b-main')
    expect(state.groupsByWorktree[B][0].activeTabId).toBe('b-chat')
    expect(state.activeGroupIdByWorktree[A]).toBe('a-pane')
    expect(selectLayoutWorktreeId(state)).toBe(A)
    // The side panel on screen is the session's own workspace's.
    expect(selectSidePanelWorktreeId(state, A)).toBe(B)
    expect(selectSidePanelWorktreeId(state, B)).toBeNull()
  })

  it('goes back to the layout’s own workspace when one of its own panes takes focus', () => {
    store.getState().focusGroup(A, 'a-pane')
    store.getState().focusGroup(A, 'a-main')
    const state = store.getState()
    expect(state.activeWorktreeId).toBe(A)
    expect(state.paneFocus).toBeNull()
    expect(selectLayoutWorktreeId(state)).toBe(A)
    expect(state.activeGroupIdByWorktree[A]).toBe('a-main')
    expect(selectSidePanelWorktreeId(state, A)).toBe(A)
  })

  it('shows the owner’s own layout once that workspace is opened from the sidebar', () => {
    store.getState().focusGroup(A, 'a-pane')
    store.getState().setActiveWorktree(B)
    const state = store.getState()
    expect(state.activeWorktreeId).toBe(B)
    expect(selectLayoutWorktreeId(state)).toBe(B)
  })

  it('leaves ordinary focus alone when no pane shows another workspace’s session', () => {
    seedStore(store, {
      groupsByWorktree: {
        ...store.getState().groupsByWorktree,
        [A]: [
          makeTabGroup({
            id: 'a-main',
            worktreeId: A,
            tabOrder: ['a-chat'],
            activeTabId: 'a-chat'
          })
        ]
      }
    })
    store.getState().focusGroup(A, 'a-main')
    expect(store.getState().activeWorktreeId).toBe(A)
    expect(store.getState().paneFocus).toBeNull()
  })
})

describe('commands while a referenced terminal session has focus', () => {
  it('target the session’s terminal, which is what search, paste, split and close read', () => {
    seedStore(store, {
      unifiedTabsByWorktree: {
        [A]: [chat('a-chat', A, 'a-main')],
        [B]: [
          makeUnifiedTab({
            id: 'b-term',
            worktreeId: B,
            groupId: 'b-main',
            contentType: 'terminal',
            entityId: 'term-1',
            viewMode: 'terminal',
            label: 'b-term'
          })
        ]
      },
      groupsByWorktree: {
        ...store.getState().groupsByWorktree,
        [A]: [
          makeTabGroup({
            id: 'a-main',
            worktreeId: A,
            tabOrder: ['a-chat'],
            activeTabId: 'a-chat'
          }),
          {
            ...makeTabGroup({ id: 'a-pane', worktreeId: A, tabOrder: [], activeTabId: null }),
            sessionRef: { worktreeId: B, tabId: 'b-term' }
          }
        ],
        [B]: [
          makeTabGroup({ id: 'b-main', worktreeId: B, tabOrder: ['b-term'], activeTabId: 'b-term' })
        ]
      }
    })
    store.getState().focusGroup(A, 'a-pane')
    const state = store.getState()
    expect(state.activeWorktreeId).toBe(B)
    expect(state.activeTabId).toBe('term-1')
    expect(state.activeTabType).toBe('terminal')
  })
})

describe('focus events from a side panel that is no longer on screen', () => {
  it('do not pull the focus back from the session’s workspace', () => {
    store.getState().focusGroup(A, 'a-pane')
    store.getState().focusGroup(A, `side-panel:${A}`)
    const state = store.getState()
    expect(state.activeWorktreeId).toBe(B)
    expect(state.paneFocus).toEqual({ layoutWorktreeId: A, ownerWorktreeId: B, groupId: 'a-pane' })
  })
})
