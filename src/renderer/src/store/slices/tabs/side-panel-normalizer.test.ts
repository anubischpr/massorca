import { describe, expect, it } from 'vitest'
import { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } from '../store-test-helpers'
import { installSidePanelNormalizer } from './side-panel-normalizer'
import { selectSidePanelOpen } from './side-panel-state'
import { sidePanelGroupId } from './side-panel-group'

const WT = 'repo::/work/a'
const MAIN = 'main-group'

function mainWithChat() {
  const store = createTestStore()
  seedStore(store, {
    activeWorktreeId: WT,
    unifiedTabsByWorktree: {
      [WT]: [
        makeUnifiedTab({ id: 'chat', worktreeId: WT, groupId: MAIN, contentType: 'agent-session' })
      ]
    },
    groupsByWorktree: {
      [WT]: [makeTabGroup({ id: MAIN, worktreeId: WT, tabOrder: ['chat'], activeTabId: 'chat' })]
    },
    layoutByWorktree: { [WT]: { type: 'leaf', groupId: MAIN } },
    activeGroupIdByWorktree: { [WT]: MAIN }
  })
  return store
}

describe('installSidePanelNormalizer', () => {
  it('migrates tabs that were already in the store when it starts', () => {
    const store = createTestStore()
    seedStore(store, {
      unifiedTabsByWorktree: {
        [WT]: [makeUnifiedTab({ id: 'term', worktreeId: WT, groupId: MAIN })]
      },
      groupsByWorktree: {
        [WT]: [makeTabGroup({ id: MAIN, worktreeId: WT, tabOrder: ['term'], activeTabId: 'term' })]
      },
      layoutByWorktree: { [WT]: { type: 'leaf', groupId: MAIN } }
    })
    const stop = installSidePanelNormalizer(store)
    expect(store.getState().unifiedTabsByWorktree[WT][0].groupId).toBe(sidePanelGroupId(WT))
    stop()
  })

  it('moves a tab created in a main group into the panel and opens the panel', () => {
    const store = mainWithChat()
    const stop = installSidePanelNormalizer(store)
    store.getState().setSidePanelOpen(WT, false)
    const created = store.getState().createUnifiedTab(WT, 'browser', { targetGroupId: MAIN })
    const state = store.getState()
    expect(state.unifiedTabsByWorktree[WT].find((t) => t.id === created.id)?.groupId).toBe(
      sidePanelGroupId(WT)
    )
    expect(selectSidePanelOpen(state, WT)).toBe(true)
    stop()
  })

  it('does not open the panel for tabs that are not the new active one', () => {
    const store = mainWithChat()
    const stop = installSidePanelNormalizer(store)
    store.getState().setSidePanelOpen(WT, false)
    store.getState().createUnifiedTab(WT, 'agent-session', { targetGroupId: MAIN })
    expect(selectSidePanelOpen(store.getState(), WT)).toBe(false)
    stop()
  })

  it('stops reacting once uninstalled', () => {
    const store = mainWithChat()
    const stop = installSidePanelNormalizer(store)
    stop()
    const created = store.getState().createUnifiedTab(WT, 'browser', { targetGroupId: MAIN })
    expect(
      store.getState().unifiedTabsByWorktree[WT].find((t) => t.id === created.id)?.groupId
    ).toBe(MAIN)
  })

  it('converges after a paired-runtime snapshot re-adds the panel group to the layout', () => {
    const store = mainWithChat()
    const stop = installSidePanelNormalizer(store)
    store.getState().createUnifiedTab(WT, 'browser', { targetGroupId: MAIN })
    const panel = sidePanelGroupId(WT)
    let notifications = 0
    const unsubscribe = store.subscribe(() => void (notifications += 1))
    // Why: client-owned placement appends a leaf for every surviving group that the layout lacks.
    for (let snapshot = 0; snapshot < 3; snapshot += 1) {
      const before = notifications
      store.setState({
        layoutByWorktree: {
          [WT]: {
            type: 'split',
            direction: 'horizontal',
            first: { type: 'leaf', groupId: MAIN },
            second: { type: 'leaf', groupId: panel }
          }
        }
      })
      expect(store.getState().layoutByWorktree[WT]).toEqual({ type: 'leaf', groupId: MAIN })
      expect(notifications - before).toBeLessThanOrEqual(2)
    }
    unsubscribe()
    stop()
  })
})

describe('a terminal that becomes a session after it was created', () => {
  it('returns to the main area once it carries a view mode', () => {
    const store = mainWithChat()
    const stop = installSidePanelNormalizer(store)
    const created = store.getState().createUnifiedTab(WT, 'terminal', { targetGroupId: MAIN })
    expect(store.getState().unifiedTabsByWorktree[WT].find((t) => t.id === created.id)?.groupId).toBe(
      sidePanelGroupId(WT)
    )
    store.getState().setTabViewMode(created.id, 'terminal')
    const moved = store.getState().unifiedTabsByWorktree[WT].find((t) => t.id === created.id)
    expect(moved?.viewMode).toBe('terminal')
    expect(moved?.groupId).not.toBe(sidePanelGroupId(WT))
    stop()
  })
})
