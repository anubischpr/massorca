import { describe, expect, it } from 'vitest'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../../shared/constants'
import { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } from '../store-test-helpers'
import {
  isSessionTab,
  isSidePanelGroupId,
  planSidePanelNormalization,
  selectFocusedSessionTab,
  sidePanelGroupId
} from './side-panel-group'

const WT = 'repo::/work/a'
const MAIN = 'main-group'

function seeded(args: {
  tabs: Parameters<typeof makeUnifiedTab>[0][]
  groups: Parameters<typeof makeTabGroup>[0][]
  layout?: ReturnType<ReturnType<typeof createTestStore>['getState']>['layoutByWorktree']
  activeGroupId?: string
}) {
  const store = createTestStore()
  seedStore(store, {
    activeWorktreeId: WT,
    unifiedTabsByWorktree: { [WT]: args.tabs.map(makeUnifiedTab) },
    groupsByWorktree: { [WT]: args.groups.map(makeTabGroup) },
    layoutByWorktree: args.layout ?? { [WT]: { type: 'leaf', groupId: MAIN } },
    activeGroupIdByWorktree: { [WT]: args.activeGroupId ?? MAIN }
  })
  return store
}

describe('side panel group identity', () => {
  it('derives a stable group id per workspace and recognises it', () => {
    expect(sidePanelGroupId(WT)).toBe(`side-panel:${WT}`)
    expect(isSidePanelGroupId(sidePanelGroupId(WT))).toBe(true)
    expect(isSidePanelGroupId(MAIN)).toBe(false)
    expect(isSidePanelGroupId(undefined)).toBe(false)
  })

  it('treats chat sessions and agent terminals as sessions, everything else as panel tabs', () => {
    expect(isSessionTab({ contentType: 'agent-session' })).toBe(true)
    expect(isSessionTab({ contentType: 'terminal', viewMode: 'chat' })).toBe(true)
    expect(isSessionTab({ contentType: 'terminal', viewMode: 'terminal' })).toBe(true)
    expect(isSessionTab({ contentType: 'terminal' })).toBe(false)
    expect(isSessionTab({ contentType: 'browser' })).toBe(false)
    expect(isSessionTab({ contentType: 'editor' })).toBe(false)
    expect(isSessionTab({ contentType: 'diff' })).toBe(false)
    expect(isSessionTab({ contentType: 'simulator' })).toBe(false)
  })
})

describe('planSidePanelNormalization', () => {
  it('has nothing to do when sessions are in main and panel tabs are in the panel', () => {
    const panel = sidePanelGroupId(WT)
    const store = seeded({
      tabs: [
        { id: 'chat', worktreeId: WT, groupId: MAIN, contentType: 'agent-session' },
        { id: 'term', worktreeId: WT, groupId: panel, contentType: 'terminal' }
      ],
      groups: [
        { id: MAIN, worktreeId: WT, tabOrder: ['chat'], activeTabId: 'chat' },
        { id: panel, worktreeId: WT, tabOrder: ['term'], activeTabId: 'term' }
      ]
    })
    expect(planSidePanelNormalization(store.getState(), WT)).toBeNull()
  })

  it('moves non-session tabs out of main groups into the panel group without losing any', () => {
    const panel = sidePanelGroupId(WT)
    const store = seeded({
      tabs: [
        { id: 'chat', worktreeId: WT, groupId: MAIN, contentType: 'agent-session' },
        { id: 'term', worktreeId: WT, groupId: MAIN, contentType: 'terminal' },
        { id: 'web', worktreeId: WT, groupId: MAIN, contentType: 'browser' },
        { id: 'file', worktreeId: WT, groupId: MAIN, contentType: 'editor' }
      ],
      groups: [
        {
          id: MAIN,
          worktreeId: WT,
          tabOrder: ['chat', 'term', 'web', 'file'],
          activeTabId: 'chat'
        }
      ]
    })
    const patch = planSidePanelNormalization(store.getState(), WT)
    expect(patch).not.toBeNull()
    store.setState(patch ?? {})
    const state = store.getState()
    const groups = state.groupsByWorktree[WT]
    expect(groups.find((g) => g.id === MAIN)?.tabOrder).toEqual(['chat'])
    expect(groups.find((g) => g.id === panel)?.tabOrder).toEqual(['term', 'web', 'file'])
    const tabs = state.unifiedTabsByWorktree[WT]
    expect(tabs.map((t) => t.id).sort()).toEqual(['chat', 'file', 'term', 'web'])
    expect(tabs.find((t) => t.id === 'web')?.groupId).toBe(panel)
    expect(tabs.find((t) => t.id === 'chat')?.groupId).toBe(MAIN)
    expect(planSidePanelNormalization(state, WT)).toBeNull()
  })

  it('merges every split group into one panel group in layout order and drops emptied groups', () => {
    const panel = sidePanelGroupId(WT)
    const store = seeded({
      tabs: [
        { id: 'chat', worktreeId: WT, groupId: MAIN, contentType: 'agent-session' },
        { id: 'a', worktreeId: WT, groupId: MAIN, contentType: 'terminal' },
        { id: 'b', worktreeId: WT, groupId: 'right', contentType: 'terminal' }
      ],
      groups: [
        { id: MAIN, worktreeId: WT, tabOrder: ['chat', 'a'], activeTabId: 'a' },
        { id: 'right', worktreeId: WT, tabOrder: ['b'], activeTabId: 'b' }
      ],
      layout: {
        [WT]: {
          type: 'split',
          direction: 'horizontal',
          first: { type: 'leaf', groupId: MAIN },
          second: { type: 'leaf', groupId: 'right' }
        }
      }
    })
    store.setState(planSidePanelNormalization(store.getState(), WT) ?? {})
    const state = store.getState()
    const groups = state.groupsByWorktree[WT]
    expect(groups.map((g) => g.id).sort()).toEqual([MAIN, panel].sort())
    expect(groups.find((g) => g.id === panel)?.tabOrder).toEqual(['a', 'b'])
    expect(groups.find((g) => g.id === MAIN)?.activeTabId).toBe('chat')
    expect(state.layoutByWorktree[WT]).toEqual({ type: 'leaf', groupId: MAIN })
  })

  it('leaves a worktree with only panel tabs with no main layout', () => {
    const panel = sidePanelGroupId(WT)
    const store = seeded({
      tabs: [{ id: 'a', worktreeId: WT, groupId: MAIN, contentType: 'terminal' }],
      groups: [{ id: MAIN, worktreeId: WT, tabOrder: ['a'], activeTabId: 'a' }]
    })
    store.setState(planSidePanelNormalization(store.getState(), WT) ?? {})
    const state = store.getState()
    expect(state.groupsByWorktree[WT].map((g) => g.id)).toEqual([panel])
    expect(state.layoutByWorktree[WT]).toBeUndefined()
    expect(state.activeGroupIdByWorktree[WT]).toBe(panel)
    expect(state.groupsByWorktree[WT][0].activeTabId).toBe('a')
  })

  it('moves a session that landed in the panel back to a main group', () => {
    const panel = sidePanelGroupId(WT)
    const store = seeded({
      tabs: [
        { id: 'chat', worktreeId: WT, groupId: panel, contentType: 'agent-session' },
        { id: 'term', worktreeId: WT, groupId: panel, contentType: 'terminal' }
      ],
      groups: [
        { id: MAIN, worktreeId: WT, tabOrder: [], activeTabId: null },
        { id: panel, worktreeId: WT, tabOrder: ['chat', 'term'], activeTabId: 'chat' }
      ]
    })
    store.setState(planSidePanelNormalization(store.getState(), WT) ?? {})
    const groups = store.getState().groupsByWorktree[WT]
    expect(groups.find((g) => g.id === MAIN)?.tabOrder).toEqual(['chat'])
    expect(groups.find((g) => g.id === panel)?.tabOrder).toEqual(['term'])
    expect(groups.find((g) => g.id === panel)?.activeTabId).toBe('term')
  })

  it('removes a panel leaf from the main layout', () => {
    const panel = sidePanelGroupId(WT)
    const store = seeded({
      tabs: [
        { id: 'chat', worktreeId: WT, groupId: MAIN, contentType: 'agent-session' },
        { id: 'term', worktreeId: WT, groupId: panel, contentType: 'terminal' }
      ],
      groups: [
        { id: MAIN, worktreeId: WT, tabOrder: ['chat'], activeTabId: 'chat' },
        { id: panel, worktreeId: WT, tabOrder: ['term'], activeTabId: 'term' }
      ],
      layout: {
        [WT]: {
          type: 'split',
          direction: 'horizontal',
          first: { type: 'leaf', groupId: MAIN },
          second: { type: 'leaf', groupId: panel }
        }
      }
    })
    store.setState(planSidePanelNormalization(store.getState(), WT) ?? {})
    expect(store.getState().layoutByWorktree[WT]).toEqual({ type: 'leaf', groupId: MAIN })
  })

  it('focuses the panel when the tab that moved was the one the user was on', () => {
    const panel = sidePanelGroupId(WT)
    const store = seeded({
      tabs: [
        { id: 'chat', worktreeId: WT, groupId: MAIN, contentType: 'agent-session' },
        { id: 'term', worktreeId: WT, groupId: MAIN, contentType: 'terminal' }
      ],
      groups: [{ id: MAIN, worktreeId: WT, tabOrder: ['chat', 'term'], activeTabId: 'term' }]
    })
    store.setState(planSidePanelNormalization(store.getState(), WT) ?? {})
    const state = store.getState()
    expect(state.activeGroupIdByWorktree[WT]).toBe(panel)
    expect(state.groupsByWorktree[WT].find((g) => g.id === panel)?.activeTabId).toBe('term')
    expect(state.groupsByWorktree[WT].find((g) => g.id === MAIN)?.activeTabId).toBe('chat')
  })
})

describe('selectFocusedSessionTab', () => {
  it('returns the active session of the main group even while the panel has focus', () => {
    const panel = sidePanelGroupId(WT)
    const store = seeded({
      tabs: [
        { id: 'chat', worktreeId: WT, groupId: MAIN, contentType: 'agent-session' },
        { id: 'term', worktreeId: WT, groupId: panel, contentType: 'terminal' }
      ],
      groups: [
        { id: MAIN, worktreeId: WT, tabOrder: ['chat'], activeTabId: 'chat' },
        { id: panel, worktreeId: WT, tabOrder: ['term'], activeTabId: 'term' }
      ],
      activeGroupId: panel
    })
    expect(selectFocusedSessionTab(store.getState(), WT)?.id).toBe('chat')
    expect(selectFocusedSessionTab(store.getState(), null)).toBeNull()
  })

  it('is null when the main area has no session', () => {
    const store = seeded({ tabs: [], groups: [{ id: MAIN, worktreeId: WT }] })
    expect(selectFocusedSessionTab(store.getState(), WT)).toBeNull()
  })
})

describe('a session created while only the panel group exists', () => {
  it('moves into a new main group and takes over the layout', () => {
    const panel = sidePanelGroupId(WT)
    const store = seeded({
      tabs: [{ id: 'chat', worktreeId: WT, groupId: panel, contentType: 'agent-session' }],
      groups: [{ id: panel, worktreeId: WT, tabOrder: ['chat'], activeTabId: 'chat' }],
      layout: { [WT]: { type: 'leaf', groupId: panel } },
      activeGroupId: panel
    })
    store.setState(planSidePanelNormalization(store.getState(), WT) ?? {})
    const state = store.getState()
    const mainGroup = state.groupsByWorktree[WT].find((group) => group.id !== panel)
    expect(mainGroup?.tabOrder).toEqual(['chat'])
    expect(state.layoutByWorktree[WT]).toEqual({ type: 'leaf', groupId: mainGroup?.id })
    expect(state.unifiedTabsByWorktree[WT][0].groupId).toBe(mainGroup?.id)
    expect(planSidePanelNormalization(state, WT)).toBeNull()
  })
})

describe('the floating workspace', () => {
  it('keeps its own tabs where they are', () => {
    const store = createTestStore()
    seedStore(store, {
      unifiedTabsByWorktree: {
        [FLOATING_TERMINAL_WORKTREE_ID]: [
          makeUnifiedTab({ id: 'f1', worktreeId: FLOATING_TERMINAL_WORKTREE_ID, groupId: 'fg' })
        ]
      },
      groupsByWorktree: {
        [FLOATING_TERMINAL_WORKTREE_ID]: [
          makeTabGroup({
            id: 'fg',
            worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
            tabOrder: ['f1'],
            activeTabId: 'f1'
          })
        ]
      }
    })
    expect(planSidePanelNormalization(store.getState(), FLOATING_TERMINAL_WORKTREE_ID)).toBeNull()
  })
})
