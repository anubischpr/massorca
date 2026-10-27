// An Orca-published create-chat setup row: its roster id, which a stop names back and "Show output"
// reads the PTY id from, and the fields it carries onto a child row.

const PREFIX = 'worktree-setup:'

export function worktreeSetupTaskId(ptyId: string): string {
  return `${PREFIX}${ptyId}`
}

/** The PTY id a setup row's id names, or null for any other task. */
export function worktreeSetupPtyIdFromTaskId(taskId: string): string | null {
  return taskId.startsWith(PREFIX) && taskId.length > PREFIX.length
    ? taskId.slice(PREFIX.length)
    : null
}

export type WorktreeSetupRowFields = { origin?: 'orca'; exitCode?: number }

/** The row fields a roster task carries onto its child row; none for a provider's own row. */
export function worktreeSetupRowFields(task: WorktreeSetupRowFields): WorktreeSetupRowFields {
  return {
    ...(task.origin !== undefined ? { origin: task.origin } : {}),
    ...(task.exitCode !== undefined ? { exitCode: task.exitCode } : {})
  }
}
