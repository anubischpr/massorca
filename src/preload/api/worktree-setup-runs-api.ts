/** Create-chat worktree setup runs: a PTY with no tab, kept across a reload and shown in the chat roster. */
export type WorktreeSetupRunsApi = {
  register: (args: { ptyId: string; worktreeId: string }) => Promise<{ ok: true }>
  bindSession: (args: { worktreeId: string; sessionId: string }) => Promise<{ ok: true }>
  worktreeIdFor: (args: { ptyId: string }) => Promise<{ worktreeId: string | null }>
}
