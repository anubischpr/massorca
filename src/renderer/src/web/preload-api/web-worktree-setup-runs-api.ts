import type { WorktreeSetupRunsApi } from '../../../../preload/api/worktree-setup-runs-api'

export function createWebWorktreeSetupRunsApi(): WorktreeSetupRunsApi {
  return {
    // Why: the web client runs setup on its runtime host; it never spawns a local PTY to register.
    register: async () => {
      throw new Error('web_runtime_unsupported')
    }
  }
}
