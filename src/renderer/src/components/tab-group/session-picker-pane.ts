import { useAppStore } from '../../store'
import { isSessionTab, isSidePanelGroupId } from '../../store/slices/tabs/side-panel-group'
import { selectSessionTabLabel } from '../../store/slices/tabs/session-tab-label'
import { selectReferencedSessions } from '../../store/slices/tabs/pane-session-ref'
import { findKnownWorktreeById } from '../../store/slices/worktrees/listing/detected-worktree-meta'
import { getWorktreeAttachmentLabel } from '../../lib/worktree-attachment-label'
import { mirrorWebRuntimeTabMove } from '../tab-bar/web-runtime-tab-move-mirror'

type PickerState = Pick<
  ReturnType<typeof useAppStore.getState>,
  'groupsByWorktree' | 'unifiedTabsByWorktree' | 'tabsByWorktree' | 'settings'
>

export type OtherWorkspacesState = PickerState &
  Pick<
    ReturnType<typeof useAppStore.getState>,
    'repos' | 'worktreesByRepo' | 'detectedWorktreesByRepo' | 'folderWorkspaces'
  > &
  Partial<Pick<ReturnType<typeof useAppStore.getState>, 'floatingWorkspacePath'>>

export type SessionPickerCandidate = { tabId: string; label: string }
export type OtherWorkspaceSessionCandidate = SessionPickerCandidate & { worktreeId: string }
export type OtherWorkspaceSessionGroup = {
  worktreeId: string
  heading: string
  candidates: OtherWorkspaceSessionCandidate[]
}

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

/**
 * Sessions of every other workspace the app lists (local, SSH and folder), grouped under the
 * sidebar's own project and workspace names. A session some pane already shows is left out.
 */
export function listOtherWorkspaceSessionGroups(
  state: OtherWorkspacesState,
  layoutWorktreeId: string,
  options: {
    /** Also list a session some pane already shows, for a picker that reads it rather than moves it. */
    includeReferenced?: boolean
  } = {}
): OtherWorkspaceSessionGroup[] {
  const referenced = options.includeReferenced ? new Set<string>() : selectReferencedSessions(state)
  const lookup = { floatingWorkspacePath: null, ...state }
  const groups: (OtherWorkspaceSessionGroup & { order: number })[] = []
  for (const [worktreeId, tabs] of Object.entries(state.unifiedTabsByWorktree)) {
    const worktree =
      worktreeId === layoutWorktreeId ? undefined : findKnownWorktreeById(lookup, worktreeId)
    if (!worktree) {
      continue
    }
    const mainIds = new Set(
      (state.groupsByWorktree[worktreeId] ?? [])
        .filter((group) => !isSidePanelGroupId(group.id))
        .map((group) => group.id)
    )
    const candidates = tabs
      .filter((tab) => isSessionTab(tab) && mainIds.has(tab.groupId) && !referenced.has(tab.id))
      .map((tab) => ({
        tabId: tab.id,
        worktreeId,
        label: selectSessionTabLabel(state, worktreeId, tab)
      }))
    if (candidates.length === 0) {
      continue
    }
    const repoIndex = state.repos.findIndex((repo) => repo.id === worktree.repoId)
    const label = getWorktreeAttachmentLabel(worktree)
    groups.push({
      worktreeId,
      heading: repoIndex !== -1 ? `${state.repos[repoIndex].displayName} / ${label}` : label,
      candidates,
      order: repoIndex !== -1 ? repoIndex : state.repos.length
    })
  }
  return groups.sort((a, b) => a.order - b.order).map(({ order: _order, ...group }) => group)
}

/** A session of this layout's workspace moves into the pane; another workspace's is shown by reference. */
export function chooseSessionForPane(
  layoutWorktreeId: string,
  groupId: string,
  session: { tabId: string; worktreeId: string }
): boolean {
  return session.worktreeId === layoutWorktreeId
    ? moveSessionIntoPane(layoutWorktreeId, session.tabId, groupId)
    : useAppStore.getState().showSessionInPane(layoutWorktreeId, groupId, {
        worktreeId: session.worktreeId,
        tabId: session.tabId
      })
}
