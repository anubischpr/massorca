import { useMemo } from 'react'
import type { Repo } from '../../../../shared/repo-types'
import { isFolderRepo } from '../../../../shared/repo-kind'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  deriveAiVaultNestedWorktreePaths,
  deriveAiVaultWorkspaceScopePaths
} from './ai-vault-scope-paths'

/** Scope paths for This worktree, the nested worktrees it leaves out, and the folder flag. */
export function useAiVaultWorkspaceScope({
  activeWorktree,
  activeRepo,
  allWorktrees
}: {
  activeWorktree: Worktree | null
  activeRepo: Repo | null
  allWorktrees: readonly Worktree[]
}) {
  const activeWorktreePaths = useMemo(
    () => deriveAiVaultWorkspaceScopePaths(activeWorktree, allWorktrees),
    [activeWorktree, allWorktrees]
  )
  const excludedWorktreePaths = useMemo(
    () => deriveAiVaultNestedWorktreePaths(activeWorktree, allWorktrees),
    [activeWorktree, allWorktrees]
  )
  // Why: a folder workspace is a plain folder, not a git worktree, so its scope names the folder.
  const activeWorkspaceIsFolder = activeRepo ? isFolderRepo(activeRepo) : false
  return { activeWorktreePaths, excludedWorktreePaths, activeWorkspaceIsFolder }
}
