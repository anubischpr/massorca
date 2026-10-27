// The PTYs Orca starts for a create-chat worktree's setup script. They have no tab, so the registry
// (not the tab model) is what keeps them alive across a renderer reload and names them to the roster.

export type WorktreeSetupRun = {
  ptyId: string
  worktreeId: string
  startedAt: number
}

const runsByPtyId = new Map<string, WorktreeSetupRun>()

export function registerWorktreeSetupRun(run: WorktreeSetupRun): void {
  runsByPtyId.set(run.ptyId, run)
}

/** Whether a PTY is a registered setup run; the reload orphan sweep spares these. */
export function isWorktreeSetupRunPty(ptyId: string): boolean {
  return runsByPtyId.has(ptyId)
}

export function _resetWorktreeSetupRunRegistryForTest(): void {
  runsByPtyId.clear()
}
