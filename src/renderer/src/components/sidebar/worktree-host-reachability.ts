import { getExplicitRuntimeEnvironmentIdForWorktree } from '@/lib/worktree-runtime-owner'
import {
  isDisconnectedRuntimeHostState,
  runtimeHostConnectionStateForEntry
} from '@/runtime/runtime-host-connection-state'
import { selectRuntimeAwareSshStatus } from '@/store/slices/runtime-environment-ssh'
import { findKnownWorktreeById } from '@/store/slices/worktrees/listing/detected-worktree-meta'
import type { AppState } from '@/store/types'
import { isRuntimeOwnedSshTargetId, parseExecutionHostId } from '../../../../shared/execution-host'
import type { SshConnectionStatus } from '../../../../shared/ssh-types'

/** The worktree and repo fields that decide whether a card's host can be reached. */
export type WorktreeHostSubject = {
  worktree: { id: string; runtimeOwnerEnvironmentId?: string }
  repo: { connectionId?: string | null; executionHostId?: string | null } | undefined
}

/** The SSH target status a card shows for its repo; null when the repo has no target or a runtime owns it. */
export function selectWorktreeSshStatus(
  state: AppState,
  { worktree, repo }: WorktreeHostSubject
): SshConnectionStatus | null {
  // Why: runtime-owned SSH targets suppress their ssh:state-changed broadcasts, so don't show a false "disconnected" chip for them.
  if (!repo?.connectionId || isRuntimeOwnedSshTargetId(repo.connectionId)) {
    return null
  }
  return selectRuntimeAwareSshStatus(
    state,
    getExplicitRuntimeEnvironmentIdForWorktree(state, worktree.id),
    repo.connectionId
  )
}

/** Whether the runtime that owns the worktree is known to be unreachable. */
export function isWorktreeRuntimeHostDisconnected(
  state: AppState,
  { worktree, repo }: WorktreeHostSubject
): boolean {
  const parsedRepoHost = parseExecutionHostId(repo?.executionHostId)
  const runtimeOwnerEnvironmentId =
    worktree.runtimeOwnerEnvironmentId ??
    (parsedRepoHost?.kind === 'runtime' ? parsedRepoHost.environmentId : null)
  if (!runtimeOwnerEnvironmentId) {
    return false
  }
  // Why the shared derivation, not raw truthiness: an absent entry means "not probed yet",
  // which is not the same verdict as a probe that came back unreachable.
  return isDisconnectedRuntimeHostState(
    runtimeHostConnectionStateForEntry(
      state.runtimeStatusByEnvironmentId.get(runtimeOwnerEnvironmentId)
    )
  )
}

/** Whether a card's host cannot be reached, by SSH or by its runtime. */
export function isWorktreeHostDisconnected(state: AppState, subject: WorktreeHostSubject): boolean {
  const sshStatus = selectWorktreeSshStatus(state, subject)
  return (
    (sshStatus != null && sshStatus !== 'connected') ||
    isWorktreeRuntimeHostDisconnected(state, subject)
  )
}

/**
 * Whether each named worktree's host cannot be reached. A worktree the store does not know reads as
 * reachable, so a stale id never dims a row.
 */
export function selectHostDisconnectedByWorktreeId(
  state: AppState,
  worktreeIds: readonly string[]
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const worktreeId of worktreeIds) {
    const worktree = findKnownWorktreeById(state, worktreeId)
    const repo = worktree?.repoId
      ? state.repos.find((candidate) => candidate.id === worktree.repoId)
      : undefined
    out[worktreeId] = worktree ? isWorktreeHostDisconnected(state, { worktree, repo }) : false
  }
  return out
}
