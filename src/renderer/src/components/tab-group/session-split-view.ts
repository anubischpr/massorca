import { useAppStore } from '../../store'
import { isSessionTab, isSidePanelGroupId } from '../../store/slices/tabs/side-panel-group'
import {
  selectLayoutWorktreeId,
  selectReferencedSessions
} from '../../store/slices/tabs/pane-session-ref'
import { chooseSessionForPane, closeSessionPane } from './session-picker-pane'

type SplitViewState = Pick<
  ReturnType<typeof useAppStore.getState>,
  | 'activeWorktreeId'
  | 'paneFocus'
  | 'groupsByWorktree'
  | 'unifiedTabsByWorktree'
  | 'activeGroupIdByWorktree'
>

export type SplitViewSession = { worktreeId: string; tabId: string }

/** The main pane a split opens beside: the focused one, or the layout's first when the side panel has the focus. */
function splitSourceGroupId(state: SplitViewState, layoutWorktreeId: string): string | null {
  const main = (state.groupsByWorktree[layoutWorktreeId] ?? []).filter(
    (group) => !isSidePanelGroupId(group.id)
  )
  const active = state.activeGroupIdByWorktree[layoutWorktreeId]
  return (main.find((group) => group.id === active) ?? main[0])?.id ?? null
}

/** True for a session no pane shows, while a layout with a pane to split beside is the one to show it in. */
export function canOpenSessionInSplitView(
  state: SplitViewState,
  session: SplitViewSession
): boolean {
  const layoutWorktreeId = selectLayoutWorktreeId(state)
  if (!layoutWorktreeId || !splitSourceGroupId(state, layoutWorktreeId)) {
    return false
  }
  const tab = (state.unifiedTabsByWorktree[session.worktreeId] ?? []).find(
    (candidate) => candidate.id === session.tabId
  )
  if (!tab || !isSessionTab(tab) || isSidePanelGroupId(tab.groupId)) {
    return false
  }
  if (selectReferencedSessions(state).has(session.tabId)) {
    return false
  }
  // Why: a session another workspace's layout shows is on screen only while that layout is.
  return session.worktreeId !== layoutWorktreeId
    ? true
    : !(state.groupsByWorktree[layoutWorktreeId] ?? []).some(
        (group) => !isSidePanelGroupId(group.id) && group.activeTabId === session.tabId
      )
}

/**
 * Opens the session in a new pane right of the focused one, in the layout on screen, and focuses
 * it: a session of that layout's workspace moves there, another workspace's is shown by reference.
 */
export function openSessionInSplitView(session: SplitViewSession): boolean {
  const state = useAppStore.getState()
  const layoutWorktreeId = selectLayoutWorktreeId(state)
  const sourceGroupId = layoutWorktreeId ? splitSourceGroupId(state, layoutWorktreeId) : null
  if (!layoutWorktreeId || !sourceGroupId) {
    return false
  }
  const paneId = state.createEmptySplitGroup(layoutWorktreeId, sourceGroupId, 'right')
  if (!paneId) {
    return false
  }
  if (!chooseSessionForPane(layoutWorktreeId, paneId, session)) {
    closeSessionPane(layoutWorktreeId, paneId)
    return false
  }
  const after = useAppStore.getState()
  after.focusGroup(layoutWorktreeId, paneId)
  if (after.activeView !== 'terminal') {
    after.setActiveView('terminal')
  }
  return true
}
