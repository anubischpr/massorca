import { selectWorktreeAgentRowsFromState } from '@/components/sidebar/worktree-agent-rows-from-state'
import type { AppState } from '@/store/types'
import type { Worktree } from '../../../../shared/worktree/types'
import type {
  CreateChatHostOption,
  CreateChatRepoOption,
  CreateChatWorktreeOption
} from './create-chat-selection'

/** Live agent sessions per worktree of the given projects, read from the sidebar's own session rows. */
export function selectCreateChatWorktreeSessionCounts(
  state: AppState,
  repoIds: readonly string[]
): Record<string, number> {
  const now = Date.now()
  const counts: Record<string, number> = {}
  for (const repoId of repoIds) {
    for (const worktree of state.worktreesByRepo[repoId] ?? []) {
      counts[worktree.id] = selectWorktreeAgentRowsFromState(state, worktree.id, now).filter(
        (row) => row.rowSource === 'live'
      ).length
    }
  }
  return counts
}

/** The existing worktrees of the projects, without the primary checkout. Sessions are null on a host that cannot be asked. */
export function buildCreateChatWorktreeOptions(input: {
  repos: readonly CreateChatRepoOption[]
  worktreesByRepo: Readonly<Record<string, readonly Worktree[] | undefined>>
  hosts: readonly CreateChatHostOption[]
  sessionCounts: Readonly<Record<string, number>>
}): CreateChatWorktreeOption[] {
  return input.repos.flatMap((repo) => {
    const host = input.hosts.find((candidate) => candidate.id === repo.hostId)
    const reachable = host?.health === 'local' || host?.health === 'available'
    return (input.worktreesByRepo[repo.repoId] ?? [])
      .filter((worktree) => !worktree.isMainWorktree && !worktree.isArchived)
      .map((worktree) => ({
        worktreeId: worktree.id,
        repoId: repo.repoId,
        hostId: repo.hostId,
        branch: branchLabel(worktree),
        sessions: reachable ? (input.sessionCounts[worktree.id] ?? 0) : null
      }))
  })
}

function branchLabel(worktree: Worktree): string {
  return worktree.branch.replace(/^refs\/heads\//, '') || worktree.displayName
}
