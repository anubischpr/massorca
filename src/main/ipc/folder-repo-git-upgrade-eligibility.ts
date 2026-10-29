import { realpathSync } from 'node:fs'
import type { Repo } from '../../shared/repo-types'
import type { Store } from '../persistence'
import { FOLDER_WORKSPACE_INSTANCE_SEPARATOR } from '../../shared/worktree/id'
import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import { getGitRepoRoot, isGitRepo } from '../git/repo'

/**
 * A folder project's extra workspaces are `worktreeMeta` rows keyed
 * `repoId::path::workspace:<uuid>`, and only the folder branch of the worktree listing
 * knows those keys exist. Flipping `kind` moves the repo onto the git branch, which lists
 * `git worktree list` (one path) and prunes every lineage id under the repo that is not in
 * it — so those workspaces vanish from the sidebar and their lineage is deleted. Migrating
 * them belongs to the listing code that owns both shapes, not to this watch, so refuse the
 * upgrade instead of destroying them. Such a project keeps working exactly as it does today.
 */
export function hasExtraFolderWorkspaces(
  store: Pick<Store, 'getAllWorktreeMeta'>,
  repo: Repo
): boolean {
  const prefix = `${repo.id}::${repo.path}${FOLDER_WORKSPACE_INSTANCE_SEPARATOR}`
  return Object.keys(store.getAllWorktreeMeta()).some((key) => key.startsWith(prefix))
}

function resolveRealPath(pathValue: string): string {
  try {
    return realpathSync(pathValue)
  } catch {
    return pathValue
  }
}

/**
 * Git's verdict on the folder, or null when it must stay a folder project.
 *
 * Two comparisons, deliberately at different strictness:
 * - Refuse unless the folder *is* the work-tree root. `.git` existing proves nothing —
 *   git accepts any path inside a work tree, so a stray marker in a subdirectory of
 *   another repo would otherwise flip a project whose path is not a repo root.
 * - Only hide external worktrees when the stored spelling also matches. Add Project
 *   stores the root as `rev-parse --show-toplevel` spells it while a folder project keeps
 *   the path the user picked; when a symlinked parent makes those differ, the root reads
 *   as an *external* worktree, and hiding those would hide the project's only workspace.
 */
export function resolveUpgrade(
  repoPath: string
): { folderUpgradeGitRootPath: string; externalWorktreeVisibility?: 'hide' } | null {
  if (!isGitRepo(repoPath)) {
    return null
  }
  const gitRoot = getGitRepoRoot(repoPath)
  if (resolveRealPath(gitRoot) !== resolveRealPath(repoPath)) {
    return null
  }
  return normalizeRuntimePathForComparison(gitRoot) === normalizeRuntimePathForComparison(repoPath)
    ? { folderUpgradeGitRootPath: gitRoot, externalWorktreeVisibility: 'hide' }
    : { folderUpgradeGitRootPath: gitRoot }
}
