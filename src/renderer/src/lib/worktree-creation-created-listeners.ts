const listeners = new Map<string, (worktreeId: string) => void>()

/** Tells one caller the id its create gave the workspace, before the create's pending entry goes. */
export function listenForCreatedWorktree(
  creationId: string,
  listener: (worktreeId: string) => void
): void {
  listeners.set(creationId, listener)
}

export function notifyCreatedWorktree(creationId: string, worktreeId: string): void {
  const listener = listeners.get(creationId)
  listeners.delete(creationId)
  listener?.(worktreeId)
}

export function forgetCreatedWorktreeListener(creationId: string): void {
  listeners.delete(creationId)
}
