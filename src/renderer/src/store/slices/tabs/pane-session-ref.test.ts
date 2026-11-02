import { beforeEach, describe, expect, it } from 'vitest'
import { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } from '../store-test-helpers'
import { installSidePanelNormalizer } from './side-panel-normalizer'
import { referencedPlacement, selectReferencedSessions } from './pane-session-ref'

const A = 'repo::/work/a'
const B = 'repo::/work/b'
const store = createTestStore()

function chat(id: string, worktreeId: string, groupId: string) {
  return makeUnifiedTab({ id, worktreeId, groupId, contentType: 'agent-session', label: id })
}

beforeEach(() => {
  seedStore(store, {
    activeWorktreeId: A,
    unifiedTabsByWorktree: {
      [A]: [chat('a-chat', A, 'a-main')],
      [B]: [chat('b-chat', B, 'b-main'), chat('b-two', B, 'b-main')]
    },
    groupsByWorktree: {
      [A]: [
        makeTabGroup({ id: 'a-main', worktreeId: A, tabOrder: ['a-chat'], activeTabId: 'a-chat' }),
        makeTabGroup({ id: 'a-pane', worktreeId: A, tabOrder: [], activeTabId: null })
      ],
      [B]: [
        makeTabGroup({
          id: 'b-main',
          worktreeId: B,
          tabOrder: ['b-chat', 'b-two'],
          activeTabId: 'b-chat'
        })
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

describe('showing another workspace’s session in a pane', () => {
  it('puts a reference on an empty pane and leaves the session in its own workspace', () => {
    expect(
      store.getState().showSessionInPane(A, 'a-pane', { worktreeId: B, tabId: 'b-chat' })
    ).toBe(true)
    const state = store.getState()
    expect(state.groupsByWorktree[A].find((group) => group.id === 'a-pane')?.sessionRef).toEqual({
      worktreeId: B,
      tabId: 'b-chat'
    })
    expect(state.unifiedTabsByWorktree[B].map((tab) => [tab.id, tab.groupId])).toEqual([
      ['b-chat', 'b-main'],
      ['b-two', 'b-main']
    ])
    expect(state.groupsByWorktree[B][0].tabOrder).toEqual(['b-chat', 'b-two'])
  })

  it('reports where each referenced session is shown', () => {
    store.getState().showSessionInPane(A, 'a-pane', { worktreeId: B, tabId: 'b-chat' })
    expect(selectReferencedSessions(store.getState()).get('b-chat')).toEqual({
      tabId: 'b-chat',
      ownerWorktreeId: B,
      layoutWorktreeId: A,
      groupId: 'a-pane'
    })
  })

  it('refuses a session that is already shown in another pane', () => {
    seedStore(store, {
      groupsByWorktree: {
        ...store.getState().groupsByWorktree,
        [A]: [
          ...store.getState().groupsByWorktree[A],
          {
            ...makeTabGroup({ id: 'a-other', worktreeId: A, tabOrder: [], activeTabId: null }),
            sessionRef: { worktreeId: B, tabId: 'b-chat' }
          }
        ]
      }
    })
    expect(
      store.getState().showSessionInPane(A, 'a-pane', { worktreeId: B, tabId: 'b-chat' })
    ).toBe(false)
  })

  it('refuses a pane that already holds a session, a session of the same workspace, or one that does not exist', () => {
    const show = store.getState().showSessionInPane
    expect(show(A, 'a-main', { worktreeId: B, tabId: 'b-chat' })).toBe(false)
    expect(show(A, 'a-pane', { worktreeId: A, tabId: 'a-chat' })).toBe(false)
    expect(show(A, 'a-pane', { worktreeId: B, tabId: 'gone' })).toBe(false)
  })

  it('refuses a session whose tab sits in a side panel group, as the picker does not offer it', () => {
    seedStore(store, {
      unifiedTabsByWorktree: {
        ...store.getState().unifiedTabsByWorktree,
        [B]: [chat('b-chat', B, `side-panel:${B}`), chat('b-two', B, 'b-main')]
      }
    })
    expect(
      store.getState().showSessionInPane(A, 'a-pane', { worktreeId: B, tabId: 'b-chat' })
    ).toBe(false)
    expect(store.getState().showSessionInPane(A, 'a-pane', { worktreeId: B, tabId: 'b-two' })).toBe(
      true
    )
  })

  it('clears the reference without touching the session', () => {
    store.getState().showSessionInPane(A, 'a-pane', { worktreeId: B, tabId: 'b-chat' })
    store.getState().clearPaneSessionRef(A, 'a-pane')
    expect(
      store.getState().groupsByWorktree[A].find((group) => group.id === 'a-pane')?.sessionRef
    ).toBeUndefined()
    expect(store.getState().unifiedTabsByWorktree[B]).toHaveLength(2)
  })

  it('does not list a reference whose session is gone', () => {
    seedStore(store, {
      groupsByWorktree: {
        ...store.getState().groupsByWorktree,
        [A]: [
          store.getState().groupsByWorktree[A][0],
          {
            ...makeTabGroup({ id: 'a-pane', worktreeId: A, tabOrder: [], activeTabId: null }),
            sessionRef: { worktreeId: B, tabId: 'closed' }
          }
        ]
      }
    })
    expect(selectReferencedSessions(store.getState()).size).toBe(0)
  })
})

describe('when the session or its workspace goes away', () => {
  it('leaves the pane empty, ready for the picker, instead of crashing', () => {
    const stop = installSidePanelNormalizer(store)
    store.getState().showSessionInPane(A, 'a-pane', { worktreeId: B, tabId: 'b-chat' })
    store.getState().closeUnifiedTab('b-chat')
    const pane = store.getState().groupsByWorktree[A].find((group) => group.id === 'a-pane')
    expect(pane).toBeDefined()
    expect(pane?.sessionRef).toBeUndefined()
    expect(pane?.tabOrder).toEqual([])
    stop()
  })

  it('does the same when the whole workspace is removed', () => {
    const stop = installSidePanelNormalizer(store)
    store.getState().showSessionInPane(A, 'a-pane', { worktreeId: B, tabId: 'b-chat' })
    const { [B]: _gone, ...tabsWithoutB } = store.getState().unifiedTabsByWorktree
    seedStore(store, { unifiedTabsByWorktree: tabsWithoutB })
    const pane = store.getState().groupsByWorktree[A].find((group) => group.id === 'a-pane')
    expect(pane?.sessionRef).toBeUndefined()
    expect(selectReferencedSessions(store.getState()).size).toBe(0)
    stop()
  })

  it('drops the reference once the pane receives a session of its own', () => {
    const stop = installSidePanelNormalizer(store)
    store.getState().showSessionInPane(A, 'a-pane', { worktreeId: B, tabId: 'b-chat' })
    store.getState().dropUnifiedTab('a-chat', { groupId: 'a-pane' })
    const pane = store.getState().groupsByWorktree[A].find((group) => group.id === 'a-pane')
    expect(pane?.tabOrder).toEqual(['a-chat'])
    expect(pane?.sessionRef).toBeUndefined()
    stop()
  })
})

describe('where a session shown by reference is placed', () => {
  it('anchors to the pane that shows it and is visible while that layout is on screen', () => {
    store.getState().showSessionInPane(A, 'a-pane', { worktreeId: B, tabId: 'b-chat' })
    const referenced = selectReferencedSessions(store.getState())
    expect(referencedPlacement(referenced, 'b-chat', A, { [A]: 'a-pane' })).toEqual({
      groupId: 'a-pane',
      isVisible: true,
      isFocusedGroup: true,
      focusWorktreeId: A
    })
    // Its own workspace's layout is on screen, so there is no second live copy.
    expect(referencedPlacement(referenced, 'b-chat', B, { [B]: 'b-main' })).toEqual({
      groupId: 'a-pane',
      isVisible: false,
      isFocusedGroup: false,
      focusWorktreeId: A
    })
  })

  it('has no placement for a session no pane shows by reference', () => {
    expect(referencedPlacement(selectReferencedSessions(store.getState()), 'a-chat', A, {})).toBe(
      null
    )
  })
})
