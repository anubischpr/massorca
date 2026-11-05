import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { resolveNewTabTargetGroupId } from '@/store/slices/tabs/pane-session-ref-new-session'
import type { Tab } from '../../../../../shared/tab-types'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../../shared/constants'

/** The floating workspace shows at most one New Session tab; a second "+" entry brings the first forward. */
export function findFloatingCreateSessionTab(
  state: Pick<AppState, 'unifiedTabsByWorktree'>
): Tab | undefined {
  return (state.unifiedTabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID] ?? []).find(
    (tab) => tab.contentType === 'create-session'
  )
}

/** Opens the New Session tab in the floating workspace, or brings the one it already has forward. */
export function openFloatingCreateSessionTab(label: string): string {
  const store = useAppStore.getState()
  const existing = findFloatingCreateSessionTab(store)
  if (existing) {
    store.focusGroup(FLOATING_TERMINAL_WORKTREE_ID, existing.groupId)
    store.activateTab(existing.id)
    return existing.id
  }
  const tab = store.createUnifiedTab(FLOATING_TERMINAL_WORKTREE_ID, 'create-session', {
    label,
    targetGroupId: resolveNewTabTargetGroupId(store, FLOATING_TERMINAL_WORKTREE_ID),
    activate: true
  })
  store.activateTab(tab.id)
  store.focusGroup(FLOATING_TERMINAL_WORKTREE_ID, tab.groupId)
  return tab.id
}
