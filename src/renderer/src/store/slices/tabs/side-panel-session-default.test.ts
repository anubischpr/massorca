import { describe, expect, it } from 'vitest'
import { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } from '../store-test-helpers'
import { installSidePanelNormalizer } from './side-panel-normalizer'
import { selectSidePanelOpen } from './side-panel-state'
import { sidePanelGroupId } from './side-panel-group'

const A = 'repo::/work/a'
const B = 'repo::/work/b'

function chat(id: string, worktreeId: string, groupId: string) {
  return makeUnifiedTab({ id, worktreeId, groupId, contentType: 'agent-session', label: id })
}

/** Workspace A with two side-by-side sessions, and B with one, shown by reference in A's third pane. */
function seeded() {
  const store = createTestStore()
  seedStore(store, {
    activeWorktreeId: A,
    paneFocus: null,
    sidePanelOpenByWorktree: {},
    unifiedTabsByWorktree: {
      [A]: [chat('a-one', A, 'a-left'), chat('a-two', A, 'a-right')],
      [B]: [chat('b-chat', B, 'b-main')]
    },
    groupsByWorktree: {
      [A]: [
        makeTabGroup({ id: 'a-left', worktreeId: A, tabOrder: ['a-one'], activeTabId: 'a-one' }),
        makeTabGroup({ id: 'a-right', worktreeId: A, tabOrder: ['a-two'], activeTabId: 'a-two' }),
        {
          ...makeTabGroup({ id: 'a-ref', worktreeId: A, tabOrder: [], activeTabId: null }),
          sessionRef: { worktreeId: B, tabId: 'b-chat' }
        }
      ],
      [B]: [
        makeTabGroup({ id: 'b-main', worktreeId: B, tabOrder: ['b-chat'], activeTabId: 'b-chat' })
      ]
    },
    activeGroupIdByWorktree: { [A]: 'a-left', [B]: 'b-main' },
    layoutByWorktree: {
      [A]: {
        type: 'split',
        direction: 'horizontal',
        first: { type: 'leaf', groupId: 'a-left' },
        second: {
          type: 'split',
          direction: 'horizontal',
          first: { type: 'leaf', groupId: 'a-right' },
          second: { type: 'leaf', groupId: 'a-ref' }
        }
      },
      [B]: { type: 'leaf', groupId: 'b-main' }
    }
  })
  return store
}

describe('the side panel when a session starts', () => {
  it('stays hidden when the new session’s workspace gets its terminal', () => {
    const store = seeded()
    const stop = installSidePanelNormalizer(store)
    store.getState().createUnifiedTab(A, 'terminal', { targetGroupId: 'a-left' })
    const state = store.getState()
    expect(
      state.groupsByWorktree[A].find((g) => g.id === sidePanelGroupId(A))?.tabOrder
    ).toHaveLength(1)
    expect(selectSidePanelOpen(state, A)).toBe(false)
    stop()
  })

  it('opens only when the person opens it, and stays open while they work in it', () => {
    const store = seeded()
    const stop = installSidePanelNormalizer(store)
    store.getState().focusSidePanel(A)
    expect(selectSidePanelOpen(store.getState(), A)).toBe(true)
    store.getState().createUnifiedTab(A, 'terminal', { targetGroupId: sidePanelGroupId(A) })
    expect(selectSidePanelOpen(store.getState(), A)).toBe(true)
    stop()
  })
})

describe('the side panel’s open choice belongs to one session', () => {
  it('starts hidden for the other session in a split pane, and comes back with the first', () => {
    const store = seeded()
    const stop = installSidePanelNormalizer(store)
    store.getState().setSidePanelOpen(A, true)
    store.getState().focusGroup(A, 'a-right')
    expect(selectSidePanelOpen(store.getState(), A)).toBe(false)
    store.getState().focusGroup(A, 'a-left')
    expect(selectSidePanelOpen(store.getState(), A)).toBe(true)
    stop()
  })

  it('starts hidden for a new session in the same pane', () => {
    const store = seeded()
    const stop = installSidePanelNormalizer(store)
    store.getState().setSidePanelOpen(A, true)
    store.getState().createUnifiedTab(A, 'agent-session', { targetGroupId: 'a-left' })
    expect(selectSidePanelOpen(store.getState(), A)).toBe(false)
    stop()
  })

  it('is kept apart for a session shown by reference', () => {
    const store = seeded()
    const stop = installSidePanelNormalizer(store)
    store.getState().setSidePanelOpen(A, true)
    store.getState().focusGroup(A, 'a-ref')
    // The panel on screen is now the referenced session's workspace's.
    expect(selectSidePanelOpen(store.getState(), B)).toBe(false)
    store.getState().toggleSidePanel(B)
    expect(selectSidePanelOpen(store.getState(), B)).toBe(true)
    store.getState().focusGroup(A, 'a-right')
    expect(selectSidePanelOpen(store.getState(), A)).toBe(false)
    store.getState().focusGroup(A, 'a-left')
    expect(selectSidePanelOpen(store.getState(), A)).toBe(true)
    stop()
  })
})
