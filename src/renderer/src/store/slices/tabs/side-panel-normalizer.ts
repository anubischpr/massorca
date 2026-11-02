import type { AppState } from '../../types'
import { planSessionRefCleanup } from './pane-session-ref'
import { planSidePanelNormalization, sidePanelGroupId } from './side-panel-group'

type NormalizableStore = {
  getState: () => AppState
  setState: (patch: Partial<AppState>) => void
  subscribe: (listener: (state: AppState, previous: AppState) => void) => () => void
}

function normalizeWorktree(store: NormalizableStore, worktreeId: string): void {
  const patch = planSidePanelNormalization(store.getState(), worktreeId)
  if (patch) {
    store.setState(patch)
  }
}

/** True when the panel group gained a tab and that tab is now the one it shows. */
function panelShowsNewTab(state: AppState, previous: AppState, worktreeId: string): boolean {
  const panelId = sidePanelGroupId(worktreeId)
  const panel = state.groupsByWorktree[worktreeId]?.find((group) => group.id === panelId)
  if (!panel?.activeTabId) {
    return false
  }
  const before = previous.groupsByWorktree[worktreeId]?.find((group) => group.id === panelId)
  return !before?.tabOrder.includes(panel.activeTabId)
}

/**
 * Keeps every workspace's tabs sorted into sessions (main area) and everything else (side panel),
 * whichever code path created them, and opens the panel when it receives a tab to show.
 */
export function installSidePanelNormalizer(store: NormalizableStore): () => void {
  for (const worktreeId of Object.keys(store.getState().unifiedTabsByWorktree)) {
    normalizeWorktree(store, worktreeId)
  }
  return store.subscribe((state, previous) => {
    // Why: a reference outlives neither its session nor its workspace; clear it wherever either goes.
    if (
      state.unifiedTabsByWorktree !== previous.unifiedTabsByWorktree ||
      state.groupsByWorktree !== previous.groupsByWorktree
    ) {
      const cleanup = planSessionRefCleanup(state)
      if (cleanup) {
        store.setState(cleanup)
        return
      }
    }
    if (
      state.unifiedTabsByWorktree === previous.unifiedTabsByWorktree &&
      state.groupsByWorktree === previous.groupsByWorktree &&
      state.layoutByWorktree === previous.layoutByWorktree
    ) {
      return
    }
    for (const worktreeId of Object.keys(state.unifiedTabsByWorktree)) {
      if (
        state.unifiedTabsByWorktree[worktreeId] === previous.unifiedTabsByWorktree[worktreeId] &&
        state.groupsByWorktree[worktreeId] === previous.groupsByWorktree[worktreeId] &&
        state.layoutByWorktree[worktreeId] === previous.layoutByWorktree[worktreeId]
      ) {
        continue
      }
      normalizeWorktree(store, worktreeId)
      const after = store.getState()
      if (panelShowsNewTab(after, previous, worktreeId)) {
        after.setSidePanelOpen(worktreeId, true)
      }
    }
  })
}
