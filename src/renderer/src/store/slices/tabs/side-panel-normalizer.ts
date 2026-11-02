import type { AppState } from '../../types'
import { planSessionRefCleanup } from './pane-session-ref'
import { planSidePanelNormalization, sidePanelGroupId } from './side-panel-group'
import { selectSidePanelSessionKey } from './side-panel-state'

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

/** A focus that followed a shown session returns to the pane's own workspace once the reference is gone. */
function handFocusBackFromClearedReference(store: NormalizableStore, before: AppState): void {
  const focus = before.paneFocus
  if (!focus) {
    return
  }
  const after = store.getState()
  const pane = after.groupsByWorktree[focus.layoutWorktreeId]?.find(
    (group) => group.id === focus.groupId
  )
  if (pane && !pane.sessionRef && after.paneFocus) {
    after.focusGroup(focus.layoutWorktreeId, focus.groupId)
  }
}

/**
 * True when the panel gained a tab it now shows that someone opened to look at. A terminal is
 * excluded: a new session's own terminal arrives on its own, and a terminal the person asks for
 * opens the panel through focusSidePanel.
 */
function panelShowsNewTab(state: AppState, previous: AppState, worktreeId: string): boolean {
  const panelId = sidePanelGroupId(worktreeId)
  const panel = state.groupsByWorktree[worktreeId]?.find((group) => group.id === panelId)
  if (!panel?.activeTabId) {
    return false
  }
  const before = previous.groupsByWorktree[worktreeId]?.find((group) => group.id === panelId)
  if (before?.tabOrder.includes(panel.activeTabId)) {
    return false
  }
  const shown = state.unifiedTabsByWorktree[worktreeId]?.find((tab) => tab.id === panel.activeTabId)
  return shown?.contentType !== 'terminal'
}

/** Remembers whose session the panel served when it took the focus, by whichever path. */
function rememberPanelSession(store: NormalizableStore, previous: AppState): void {
  const state = store.getState()
  let remembered: Record<string, string> | null = null
  for (const [worktreeId, groupId] of Object.entries(state.activeGroupIdByWorktree)) {
    const panelId = sidePanelGroupId(worktreeId)
    if (groupId !== panelId || previous.activeGroupIdByWorktree[worktreeId] === panelId) {
      continue
    }
    const session = selectSidePanelSessionKey(previous, worktreeId)
    if (state.sidePanelSessionByWorktree[worktreeId] !== session) {
      remembered = { ...(remembered ?? state.sidePanelSessionByWorktree), [worktreeId]: session }
    }
  }
  if (remembered) {
    store.setState({ sidePanelSessionByWorktree: remembered })
  }
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
    if (state.activeGroupIdByWorktree !== previous.activeGroupIdByWorktree) {
      rememberPanelSession(store, previous)
    }
    // Why: a reference outlives neither its session nor its workspace; clear it wherever either goes.
    if (
      state.unifiedTabsByWorktree !== previous.unifiedTabsByWorktree ||
      state.groupsByWorktree !== previous.groupsByWorktree
    ) {
      const cleanup = planSessionRefCleanup(state)
      if (cleanup) {
        store.setState(cleanup)
        handFocusBackFromClearedReference(store, state)
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
