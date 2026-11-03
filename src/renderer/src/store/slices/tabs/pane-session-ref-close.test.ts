import { beforeEach, describe, expect, it } from 'vitest'
import { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } from '../store-test-helpers'
import { selectLayoutWorktreeId } from './pane-session-ref'
import { installSidePanelNormalizer } from './side-panel-normalizer'

const A = 'repo::/work/a'
const B = 'repo::/work/b'
const store = createTestStore()

function chat(id: string, worktreeId: string, groupId: string) {
  return makeUnifiedTab({ id, worktreeId, groupId, contentType: 'agent-session', label: id })
}

function seedReference(): void {
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
}

let stop: () => void

beforeEach(() => {
  seedReference()
  stop = installSidePanelNormalizer(store)
  return () => stop()
})

describe('closing the last tab of a workspace while a pane shows another workspace’s session', () => {
  it('stays in the showing workspace when the shown session is closed from its pane', () => {
    store.getState().focusGroup(A, 'a-pane')
    store.getState().closeUnifiedTab('b-chat')
    const state = store.getState()
    expect(state.activeWorktreeId).toBe(A)
    expect(state.paneFocus).toBeNull()
    const pane = state.groupsByWorktree[A].find((group) => group.id === 'a-pane')
    expect(pane?.sessionRef).toBeUndefined()
    expect(state.activeGroupIdByWorktree[A]).toBe('a-pane')
  })

  it('keeps the showing workspace selected when its own last tab closes', () => {
    store.getState().closeUnifiedTab('a-chat')
    const state = store.getState()
    expect(state.activeWorktreeId).toBe(A)
    expect(state.groupsByWorktree[A].map((group) => group.id)).toEqual(['a-pane'])
  })

  it('keeps the showing workspace on screen when its own tab closes while the pane has focus', () => {
    store.getState().focusGroup(A, 'a-pane')
    store.getState().closeUnifiedTab('a-chat')
    const state = store.getState()
    expect(state.activeWorktreeId).not.toBeNull()
    expect(selectLayoutWorktreeId(state)).toBe(A)
  })

  it('still leaves a workspace whose last tab closes when nothing is shown in it', () => {
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
      },
      layoutByWorktree: {
        ...store.getState().layoutByWorktree,
        [A]: { type: 'leaf', groupId: 'a-main' }
      }
    })
    store.getState().closeUnifiedTab('a-chat')
    expect(store.getState().activeWorktreeId).toBeNull()
  })
})
