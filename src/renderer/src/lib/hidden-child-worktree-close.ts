import { selectBranchRowCandidatesByWorktree } from '@/components/sidebar/worktree-child-placement'
import { getWorktreeLookupIndex } from '@/store/github/worktree-refresh'
import type { AppState } from '@/store/types'
import { resolveWorktreeCardLayout } from '../../../shared/worktree/card-layout'
import { parseWorkspaceKey } from '../../../shared/workspace-scope'

/**
 * Whether closing this worktree's tab removes the worktree. Only a worktree the one-line list hides
 * under a parent's session qualifies, and only for its last tab: closing it would otherwise bring
 * back a sleeping row. A child in its parent's worktree never qualifies, since the parent's session
 * keeps that worktree listed. A folder workspace or a main checkout only closes the tab.
 */
export function closingTabRemovesHiddenChildWorktree(state: AppState, worktreeId: string): boolean {
  if (resolveWorktreeCardLayout(state.settings) !== 'one-line') {
    return false
  }
  if (parseWorkspaceKey(worktreeId)?.type === 'folder') {
    return false
  }
  // Why unique: the id alone cannot name a host, so an id two hosts share only closes the tab.
  const worktree = getWorktreeLookupIndex(state).byId.get(worktreeId)?.unique ?? null
  if (!worktree || worktree.isMainWorktree) {
    return false
  }
  return (
    selectBranchRowCandidatesByWorktree(state).has(worktreeId) &&
    (state.unifiedTabsByWorktree[worktreeId] ?? []).length === 1
  )
}
