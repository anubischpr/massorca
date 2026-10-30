import type { WorktreeMeta } from '../../shared/worktree/meta-types'

export type DelegatedChildWorktreeNameDeps = {
  isDelegatedChild: (worktreeId: string) => boolean
  getMeta: (
    worktreeId: string
  ) => Pick<WorktreeMeta, 'displayName' | 'displayNameIsPinned'> | undefined
  resolveBranch: (worktreeId: string) => Promise<string>
  renameWorktree: (worktreeId: string, displayName: string) => void
}

/**
 * Titles a delegated child's worktree from its AI conversation name. Returns false, leaving the
 * name alone, for any other worktree or when the user already chose a name.
 */
export async function nameDelegatedChildWorktree(
  worktreeId: string,
  conversationName: string,
  deps: DelegatedChildWorktreeNameDeps
): Promise<boolean> {
  const displayName = conversationName.trim()
  if (!displayName || !deps.isDelegatedChild(worktreeId)) {
    return false
  }
  const branchLeaf = branchLeafOf(await deps.resolveBranch(worktreeId))
  if (isUserSetDisplayName(deps.getMeta(worktreeId), branchLeaf)) {
    return false
  }
  deps.renameWorktree(worktreeId, displayName)
  return true
}

/**
 * A child is created with its slug as a pinned name, so a pinned name that only repeats the
 * branch leaf is still automatic; only a name the user chose differs from it.
 */
export function isUserSetDisplayName(
  meta: Pick<WorktreeMeta, 'displayName' | 'displayNameIsPinned'> | undefined,
  branchLeaf: string
): boolean {
  if (!meta || meta.displayNameIsPinned === false) {
    return false
  }
  const current = meta.displayName?.trim() ?? ''
  return current !== '' && current !== branchLeaf
}

export function branchLeafOf(branch: string): string {
  const short = branch.replace(/^refs\/heads\//, '')
  return short.slice(short.lastIndexOf('/') + 1)
}
