import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../tab-bar/web-runtime-tab-move-mirror', () => ({ mirrorWebRuntimeTabMove: vi.fn() }))

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../../store/slices/store-test-helpers')
const testStore = createTestStore()
vi.mock('../../store', () => ({ useAppStore: testStore }))

const {
  closeSessionPane,
  listSessionPickerCandidates,
  moveSessionIntoPane,
  openSessionPickerPane
} = await import('./session-picker-pane')
const { mirrorWebRuntimeTabMove } = await import('../tab-bar/web-runtime-tab-move-mirror')

const WT = 'repo::/work/a'

function session(id: string, groupId: string, label = id) {
  return makeUnifiedTab({ id, worktreeId: WT, groupId, contentType: 'agent-session', label })
}

beforeEach(() => {
  vi.mocked(mirrorWebRuntimeTabMove).mockClear()
  seedStore(testStore, {
    activeWorktreeId: WT,
    unifiedTabsByWorktree: {
      [WT]: [
        session('A', 'main', 'Fix the login redirect'),
        session('B', 'main', 'Write the release notes'),
        makeUnifiedTab({
          id: 'doc',
          worktreeId: WT,
          groupId: `side-panel:${WT}`,
          contentType: 'editor',
          label: 'notes.md'
        })
      ]
    },
    groupsByWorktree: {
      [WT]: [
        makeTabGroup({ id: 'main', worktreeId: WT, tabOrder: ['A', 'B'], activeTabId: 'A' }),
        makeTabGroup({
          id: `side-panel:${WT}`,
          worktreeId: WT,
          tabOrder: ['doc'],
          activeTabId: 'doc'
        })
      ]
    },
    activeGroupIdByWorktree: { [WT]: 'main' },
    layoutByWorktree: { [WT]: { type: 'leaf', groupId: 'main' } }
  })
})

describe('opening a pane next to the focused session', () => {
  it('adds an empty pane to the right and focuses it, instead of showing the same session again', () => {
    expect(openSessionPickerPane(WT, 'main', 'right')).toBe(true)
    const state = testStore.getState()
    const groups = state.groupsByWorktree[WT].filter((group) => !group.id.startsWith('side-panel:'))
    expect(groups).toHaveLength(2)
    const added = groups.find((group) => group.id !== 'main')
    expect(added?.tabOrder).toEqual([])
    expect(state.activeGroupIdByWorktree[WT]).toBe(added?.id)
    expect(state.layoutByWorktree[WT]).toMatchObject({ type: 'split', direction: 'horizontal' })
  })
})

describe('the sessions the new pane offers', () => {
  it('lists the sessions no pane is showing, never the one on screen or a side panel tab', () => {
    expect(listSessionPickerCandidates(testStore.getState(), WT)).toEqual([
      { tabId: 'B', label: 'Write the release notes' }
    ])
  })

  it('lists nothing when the only session is already on screen', () => {
    seedStore(testStore, {
      unifiedTabsByWorktree: { [WT]: [session('A', 'main')] },
      groupsByWorktree: {
        [WT]: [makeTabGroup({ id: 'main', worktreeId: WT, tabOrder: ['A'], activeTabId: 'A' })]
      }
    })
    expect(listSessionPickerCandidates(testStore.getState(), WT)).toEqual([])
  })

  it('ignores order entries whose session no longer exists', () => {
    seedStore(testStore, {
      groupsByWorktree: {
        [WT]: [
          makeTabGroup({
            id: 'main',
            worktreeId: WT,
            tabOrder: ['A', 'gone', 'B'],
            activeTabId: 'A'
          })
        ]
      }
    })
    expect(listSessionPickerCandidates(testStore.getState(), WT).map((c) => c.tabId)).toEqual(['B'])
  })
})

describe('choosing a session for the new pane', () => {
  it('moves it there, so one session is never in two panes, and keeps the other pane as it was', () => {
    openSessionPickerPane(WT, 'main', 'right')
    const newGroupId = testStore.getState().activeGroupIdByWorktree[WT]
    expect(moveSessionIntoPane(WT, 'B', newGroupId)).toBe(true)
    const state = testStore.getState()
    const owners = state.groupsByWorktree[WT].filter((group) => group.tabOrder.includes('B'))
    expect(owners.map((group) => group.id)).toEqual([newGroupId])
    expect(state.groupsByWorktree[WT].find((group) => group.id === 'main')?.tabOrder).toEqual(['A'])
    expect(state.groupsByWorktree[WT].find((group) => group.id === newGroupId)?.activeTabId).toBe(
      'B'
    )
    expect(listSessionPickerCandidates(state, WT)).toEqual([])
  })

  it('tells a paired host about the move', () => {
    openSessionPickerPane(WT, 'main', 'right')
    const newGroupId = testStore.getState().activeGroupIdByWorktree[WT]
    moveSessionIntoPane(WT, 'B', newGroupId)
    expect(mirrorWebRuntimeTabMove).toHaveBeenCalledWith({
      kind: 'move-to-group',
      worktreeId: WT,
      tabId: 'B',
      targetGroupId: newGroupId
    })
  })
})

describe('closing a pane', () => {
  it('closes an empty pane and leaves the sessions where they were', () => {
    openSessionPickerPane(WT, 'main', 'right')
    const paneId = testStore.getState().activeGroupIdByWorktree[WT]
    expect(closeSessionPane(WT, paneId)).toBe(true)
    const state = testStore.getState()
    expect(state.layoutByWorktree[WT]).toEqual({ type: 'leaf', groupId: 'main' })
    expect(state.groupsByWorktree[WT].find((group) => group.id === 'main')?.tabOrder).toEqual([
      'A',
      'B'
    ])
  })

  it('merges a pane that holds a session back into its neighbour', () => {
    openSessionPickerPane(WT, 'main', 'right')
    const paneId = testStore.getState().activeGroupIdByWorktree[WT]
    moveSessionIntoPane(WT, 'B', paneId)
    expect(closeSessionPane(WT, paneId)).toBe(true)
    const main = testStore.getState().groupsByWorktree[WT].find((group) => group.id === 'main')
    expect([...(main?.tabOrder ?? [])].sort()).toEqual(['A', 'B'])
  })

  it('closes a pane saved by an older version whose only session no longer exists', () => {
    seedStore(testStore, {
      groupsByWorktree: {
        [WT]: [
          makeTabGroup({ id: 'main', worktreeId: WT, tabOrder: ['A', 'B'], activeTabId: 'A' }),
          makeTabGroup({ id: 'old', worktreeId: WT, tabOrder: ['gone'], activeTabId: 'gone' })
        ]
      },
      layoutByWorktree: {
        [WT]: {
          type: 'split',
          direction: 'horizontal',
          first: { type: 'leaf', groupId: 'main' },
          second: { type: 'leaf', groupId: 'old' }
        }
      }
    })
    expect(closeSessionPane(WT, 'old')).toBe(true)
    expect(testStore.getState().layoutByWorktree[WT]).toEqual({ type: 'leaf', groupId: 'main' })
  })
})
