import type {
  PaneSessionFocus,
  Tab,
  TabGroup,
  TabGroupLayoutNode
} from '../../../../shared/tab-types'
import { isSessionTab } from './tabs/side-panel-group'
import { layoutSpanningGroups } from './tab-group-reference-repair'
import { pruneTabGroupLayoutForGroups } from './tab-group-layout-pruning'

/**
 * The saved focus on a pane that shows another workspace's session, while that pane still shows a
 * session of the restored active workspace. Anything else restores the active workspace's own layout.
 */
export function restorablePaneFocus(
  saved: PaneSessionFocus | undefined,
  groupsByWorktree: Record<string, TabGroup[]>,
  activeWorktreeId: string | null
): PaneSessionFocus | null {
  if (!saved || saved.ownerWorktreeId !== activeWorktreeId) {
    return null
  }
  const pane = (groupsByWorktree[saved.layoutWorktreeId] ?? []).find(
    (group) => group.id === saved.groupId
  )
  return pane?.sessionRef?.worktreeId === saved.ownerWorktreeId && pane.tabOrder.length === 0
    ? saved
    : null
}

/** A pane whose referenced session no longer exists closes, as any empty pane does on restore. */
export function dropDanglingSessionRefPanes(
  tabsByWorktree: Record<string, Tab[]>,
  groupsByWorktree: Record<string, TabGroup[]>,
  activeGroupIdByWorktree: Record<string, string>,
  layoutByWorktree: Record<string, TabGroupLayoutNode>
): void {
  for (const [worktreeId, groups] of Object.entries(groupsByWorktree)) {
    const kept = groups.filter(
      (group) =>
        !group.sessionRef ||
        (tabsByWorktree[group.sessionRef.worktreeId] ?? []).some(
          (tab) => tab.id === group.sessionRef?.tabId && isSessionTab(tab)
        )
    )
    if (kept.length === groups.length) {
      continue
    }
    if (kept.length === 0) {
      delete groupsByWorktree[worktreeId]
      delete activeGroupIdByWorktree[worktreeId]
      delete layoutByWorktree[worktreeId]
      continue
    }
    groupsByWorktree[worktreeId] = kept
    const keptIds = new Set(kept.map((group) => group.id))
    if (!keptIds.has(activeGroupIdByWorktree[worktreeId])) {
      activeGroupIdByWorktree[worktreeId] = kept[0].id
    }
    layoutByWorktree[worktreeId] = layoutSpanningGroups(
      kept,
      pruneTabGroupLayoutForGroups(layoutByWorktree[worktreeId], keptIds)
    )
  }
}
