import type { Worktree } from '../../../../shared/worktree/types'

/**
 * Which worktree branch rows the one-line sidebar leaves out, because a session of theirs runs under a
 * parent in another worktree. The parent's list shows that session, so the branch row would only repeat it.
 */
export type BranchRowPlacement = {
  /** Worktrees whose own row is hidden. Every session they list runs under a parent that keeps a row. */
  hiddenWorktreeIds: ReadonlySet<string>
}

export const NO_BRANCH_ROW_PLACEMENT: BranchRowPlacement = {
  hiddenWorktreeIds: new Set<string>()
}

export function resolveBranchRowPlacement(args: {
  candidatesByWorktree: ReadonlyMap<string, readonly string[]>
  worktrees: readonly Worktree[]
}): BranchRowPlacement {
  const { candidatesByWorktree, worktrees } = args
  const visibleIds = new Set(worktrees.map((worktree) => worktree.id))
  const hiddenWorktreeIds = new Set<string>()
  for (const [worktreeId, placedUnder] of candidatesByWorktree) {
    // Why: a parent filtered out of this list would take the session with it, so the child keeps its row.
    if (visibleIds.has(worktreeId) && placedUnder.every((parentId) => visibleIds.has(parentId))) {
      hiddenWorktreeIds.add(worktreeId)
    }
  }
  return { hiddenWorktreeIds }
}
