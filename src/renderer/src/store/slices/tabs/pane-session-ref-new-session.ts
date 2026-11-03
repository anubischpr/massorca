import type { TabGroupSessionRef } from '../../../../../shared/tab-types'
import type { AppState } from '../../types'

type ClaimState = Pick<
  AppState,
  | 'paneFocus'
  | 'activeWorktreeId'
  | 'groupsByWorktree'
  | 'clearPaneSessionRef'
  | 'showSessionInPane'
  | 'focusGroup'
>

export type ClaimedReferencePane = {
  worktreeId: string
  groupId: string
  /** Shows the referenced session in the pane again, for a launch that did not happen. */
  restore: () => void
}

/**
 * A new session started while a pane shows another workspace's session opens in that pane, in the
 * layout on screen, as a new tab would in an ordinary pane. The referenced session stays in its
 * own workspace.
 */
export function claimFocusedReferencePane(getState: () => ClaimState): ClaimedReferencePane | null {
  const state = getState()
  const focus = state.paneFocus
  if (!focus || state.activeWorktreeId !== focus.ownerWorktreeId) {
    return null
  }
  const { layoutWorktreeId, groupId } = focus
  const ref: TabGroupSessionRef | undefined = (state.groupsByWorktree[layoutWorktreeId] ?? []).find(
    (group) => group.id === groupId
  )?.sessionRef
  if (!ref) {
    return null
  }
  state.clearPaneSessionRef(layoutWorktreeId, groupId)
  getState().focusGroup(layoutWorktreeId, groupId)
  return {
    worktreeId: layoutWorktreeId,
    groupId,
    restore: () => {
      const current = getState()
      const pane = (current.groupsByWorktree[layoutWorktreeId] ?? []).find(
        (group) => group.id === groupId
      )
      if (!pane || pane.tabOrder.length > 0 || pane.sessionRef) {
        return
      }
      if (current.showSessionInPane(layoutWorktreeId, groupId, ref)) {
        getState().focusGroup(layoutWorktreeId, groupId)
      }
    }
  }
}
