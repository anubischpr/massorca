import { useAppStore } from '../../store'
import { isSessionTab, isSidePanelGroupId } from '../../store/slices/tabs/side-panel-group'
import { selectSessionTabLabel } from '../../store/slices/tabs/session-tab-label'
import { mirrorWebRuntimeTabMove } from '../tab-bar/web-runtime-tab-move-mirror'

type PickerState = Pick<
  ReturnType<typeof useAppStore.getState>,
  'groupsByWorktree' | 'unifiedTabsByWorktree' | 'tabsByWorktree' | 'settings'
>

export type SessionPickerCandidate = { tabId: string; label: string }

/**
 * A split opens an empty pane, never a second view of the focused session: the person picks what
 * goes in it from the sessions this workspace already has.
 */
export function openSessionPickerPane(
  worktreeId: string,
  sourceGroupId: string,
  direction: 'right' | 'down'
): boolean {
  return useAppStore.getState().createEmptySplitGroup(worktreeId, sourceGroupId, direction) !== null
}

/** Sessions of this workspace that no pane shows right now; the ones on screen are not offered. */
export function listSessionPickerCandidates(
  state: PickerState,
  worktreeId: string
): SessionPickerCandidate[] {
  const groups = (state.groupsByWorktree[worktreeId] ?? []).filter(
    (group) => !isSidePanelGroupId(group.id)
  )
  const shown = new Set(groups.map((group) => group.activeTabId))
  const mainIds = new Set(groups.map((group) => group.id))
  return (state.unifiedTabsByWorktree[worktreeId] ?? [])
    .filter((tab) => isSessionTab(tab) && mainIds.has(tab.groupId) && !shown.has(tab.id))
    .map((tab) => ({ tabId: tab.id, label: selectSessionTabLabel(state, worktreeId, tab) }))
}

/** Moves the chosen session into the pane, so a session is never in two panes. */
export function moveSessionIntoPane(
  worktreeId: string,
  tabId: string,
  targetGroupId: string
): boolean {
  const moved = useAppStore.getState().dropUnifiedTab(tabId, { groupId: targetGroupId })
  if (moved) {
    mirrorWebRuntimeTabMove({ kind: 'move-to-group', worktreeId, tabId, targetGroupId })
  }
  return moved
}

/**
 * The mouse way out of a split: the pane's sessions go to its neighbour and the pane closes. An
 * order entry whose session no longer exists, as an older version could save, is dropped first.
 */
export function closeSessionPane(worktreeId: string, groupId: string): boolean {
  const state = useAppStore.getState()
  const group = (state.groupsByWorktree[worktreeId] ?? []).find(
    (candidate) => candidate.id === groupId
  )
  if (!group) {
    return false
  }
  const live = new Set(
    (state.unifiedTabsByWorktree[worktreeId] ?? [])
      .filter((tab) => tab.groupId === groupId)
      .map((tab) => tab.id)
  )
  const kept = group.tabOrder.filter((id) => live.has(id))
  if (kept.length !== group.tabOrder.length) {
    state.reorderUnifiedTabs(groupId, kept, { recordInteraction: false })
  }
  const next = useAppStore.getState()
  const closed =
    next.mergeGroupIntoSibling(worktreeId, groupId) !== null ||
    next.closeEmptyGroup(worktreeId, groupId)
  // Why: the pane that had the focus is gone; hand the focus to this layout's own pane, which also
  // ends a focus that was following a session shown in another workspace.
  const after = useAppStore.getState()
  if (closed && after.paneFocus?.groupId === groupId) {
    const remaining = after.activeGroupIdByWorktree[worktreeId]
    const fallback = (after.groupsByWorktree[worktreeId] ?? []).find(
      (group) => group.id === remaining
    )
    after.focusGroup(
      worktreeId,
      fallback?.id ?? after.groupsByWorktree[worktreeId]?.[0]?.id ?? groupId
    )
  }
  return closed
}
