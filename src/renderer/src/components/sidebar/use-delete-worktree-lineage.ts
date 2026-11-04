import { useMemo } from 'react'
import { useAppStore } from '@/store'
import type { Worktree } from '../../../../shared/worktree/types'
import { getWorkspaceDeleteLineage } from './workspace-delete-lineage'
import { selectChildSessionWorktreesByWorktree } from './worktree-child-placement'

/** The descendants a single delete would take along: lineage children and delegated child sessions' worktrees. */
export function useDeleteWorktreeLineage(
  worktree: Worktree | null | undefined,
  allWorktrees: readonly Worktree[],
  isBatchDelete: boolean
): ReturnType<typeof getWorkspaceDeleteLineage> {
  const worktreeLineageById = useAppStore((s) => s.worktreeLineageById)
  const childSessionWorktrees = useAppStore(selectChildSessionWorktreesByWorktree)
  return useMemo(
    () =>
      !isBatchDelete && worktree
        ? getWorkspaceDeleteLineage(
            worktree,
            allWorktrees,
            worktreeLineageById,
            childSessionWorktrees
          )
        : { descendants: [], deleteAllTargets: [] },
    [allWorktrees, childSessionWorktrees, isBatchDelete, worktree, worktreeLineageById]
  )
}
