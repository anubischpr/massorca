/** Tells main that a PTY is a create-chat worktree setup run. It holds no tab and is kept across a reload. */
export type WorktreeSetupRunsApi = {
  register: (args: { ptyId: string; worktreeId: string }) => Promise<{ ok: true }>
}
