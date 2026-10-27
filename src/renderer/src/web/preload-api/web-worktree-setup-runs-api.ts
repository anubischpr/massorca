import type { WorktreeSetupRunsApi } from '../../../../preload/api/worktree-setup-runs-api'

function webUnsupported(): never {
  throw new Error('web_runtime_unsupported')
}

export function createWebWorktreeSetupRunsApi(): WorktreeSetupRunsApi {
  return {
    // Why: the web client runs setup on its runtime host; it never spawns a local PTY to register.
    register: async () => webUnsupported(),
    bindSession: async () => webUnsupported(),
    worktreeIdFor: async () => webUnsupported()
  }
}
