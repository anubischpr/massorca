import { describe, expect, it } from 'vitest'
import { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } from '../store-test-helpers'
import {
  DEFAULT_SIDE_PANEL_WIDTH,
  MAX_SIDE_PANEL_WIDTH,
  MIN_SIDE_PANEL_WIDTH,
  selectSidePanelOpen,
  selectSidePanelTabIds
} from './side-panel-state'
import { sidePanelGroupId } from './side-panel-group'

const WT = 'repo::/work/a'

function storeWithPanelTab() {
  const store = createTestStore()
  const panel = sidePanelGroupId(WT)
  seedStore(store, {
    activeWorktreeId: WT,
    unifiedTabsByWorktree: {
      [WT]: [makeUnifiedTab({ id: 't1', worktreeId: WT, groupId: panel })]
    },
    groupsByWorktree: {
      [WT]: [makeTabGroup({ id: panel, worktreeId: WT, tabOrder: ['t1'], activeTabId: 't1' })]
    }
  })
  return store
}

describe('side panel state', () => {
  it('starts at the default width', () => {
    expect(createTestStore().getState().sidePanelWidth).toBe(DEFAULT_SIDE_PANEL_WIDTH)
    expect(DEFAULT_SIDE_PANEL_WIDTH).toBe(380)
  })

  it('is hidden until opened, whether or not the panel has tabs', () => {
    expect(selectSidePanelOpen(createTestStore().getState(), WT)).toBe(false)
    expect(selectSidePanelOpen(storeWithPanelTab().getState(), WT)).toBe(false)
  })

  it('follows an explicit choice', () => {
    const store = storeWithPanelTab()
    store.getState().setSidePanelOpen(WT, false)
    expect(selectSidePanelOpen(store.getState(), WT)).toBe(false)
    store.getState().toggleSidePanel(WT)
    expect(selectSidePanelOpen(store.getState(), WT)).toBe(true)
  })

  it('opens an empty panel on request so its empty state can show', () => {
    const store = createTestStore()
    store.getState().toggleSidePanel(WT)
    expect(selectSidePanelOpen(store.getState(), WT)).toBe(true)
  })

  it('clamps the width to the supported range', () => {
    const store = createTestStore()
    store.getState().setSidePanelWidth(10)
    expect(store.getState().sidePanelWidth).toBe(MIN_SIDE_PANEL_WIDTH)
    store.getState().setSidePanelWidth(99999)
    expect(store.getState().sidePanelWidth).toBe(MAX_SIDE_PANEL_WIDTH)
    store.getState().setSidePanelWidth(420)
    expect(store.getState().sidePanelWidth).toBe(420)
  })

  it('lists only the panel group tabs, in order', () => {
    expect(selectSidePanelTabIds(storeWithPanelTab().getState(), WT)).toEqual(['t1'])
    expect(selectSidePanelTabIds(createTestStore().getState(), WT)).toEqual([])
  })
})

describe('focusSidePanel', () => {
  it('opens the panel, creates its group and makes it the focused group', () => {
    const store = createTestStore()
    seedStore(store, { activeWorktreeId: WT, activeGroupIdByWorktree: { [WT]: 'main' } })
    const id = store.getState().focusSidePanel(WT)
    const state = store.getState()
    expect(id).toBe(sidePanelGroupId(WT))
    expect(state.activeGroupIdByWorktree[WT]).toBe(id)
    expect(state.groupsByWorktree[WT].map((group) => group.id)).toEqual([id])
    expect(selectSidePanelOpen(state, WT)).toBe(true)
  })

  it('reuses an existing panel group and keeps its tabs', () => {
    const store = storeWithPanelTab()
    store.getState().focusSidePanel(WT)
    expect(store.getState().groupsByWorktree[WT]).toHaveLength(1)
    expect(selectSidePanelTabIds(store.getState(), WT)).toEqual(['t1'])
  })
})

describe('opening a workspace that has no groups yet', () => {
  it('creates the empty panel group so the panel can mount its empty state', () => {
    const store = createTestStore()
    store.getState().toggleSidePanel(WT)
    expect(store.getState().groupsByWorktree[WT].map((group) => group.id)).toEqual([
      sidePanelGroupId(WT)
    ])
    store.getState().setSidePanelOpen(WT, false)
    expect(selectSidePanelOpen(store.getState(), WT)).toBe(false)
  })
})
