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
})
