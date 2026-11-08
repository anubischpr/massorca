import { getRepoMainWorktreeId } from '../../../../shared/worktree/id'

/** The repo's primary checkout: its listed main worktree, else the id that checkout always has. */
export function createChatPrimaryWorktree(
  repo: { repoId: string; path: string },
  worktrees: readonly { id: string; path: string; isMainWorktree: boolean }[]
): { id: string; path: string } {
  const main = worktrees.find((worktree) => worktree.isMainWorktree)
  return main
    ? { id: main.id, path: main.path }
    : { id: getRepoMainWorktreeId({ id: repo.repoId, path: repo.path }), path: repo.path }
}
