/** What a failed child start left behind: the Dispatch it filed, if any, and the worktrees it created. */
export type FailedDelegatedStart = {
  dispatchId: string | null
  createdWorktreeIds: readonly string[]
}

/** The existing paths a failed start is undone through, and where their own failures are reported. */
export type FailedStartCleanup = {
  releaseDispatch: (dispatchId: string) => Promise<unknown>
  removeWorktree: (worktreeId: string) => Promise<unknown>
  warn: (message: string, error: unknown) => void
}

/**
 * Undoes a failed start, best-effort: every step runs even when an earlier one fails, and nothing
 * throws, so the start's own failure reason is the one the user reads.
 */
export async function discardFailedDelegatedStart(
  cleanup: FailedStartCleanup,
  failed: FailedDelegatedStart
): Promise<void> {
  if (failed.dispatchId !== null) {
    await cleanup
      .releaseDispatch(failed.dispatchId)
      .catch((error: unknown) =>
        cleanup.warn('releasing the Dispatch of a failed child start failed', error)
      )
  }
  for (const worktreeId of failed.createdWorktreeIds) {
    await cleanup
      .removeWorktree(worktreeId)
      .catch((error: unknown) =>
        cleanup.warn('removing the worktree of a failed child start failed', error)
      )
  }
}
