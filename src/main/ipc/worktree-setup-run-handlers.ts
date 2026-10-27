import { ipcMain } from 'electron'
import { z } from 'zod'
import { registerWorktreeSetupRun } from '../worktree-setup/setup-run-registry'

const RegisterWorktreeSetupRunArgs = z.object({
  ptyId: z.string().min(1),
  worktreeId: z.string().min(1)
})

export function registerWorktreeSetupRunHandlers(now: () => number = Date.now): void {
  ipcMain.handle('worktreeSetupRuns:register', (_event, rawArgs: unknown) => {
    const args = RegisterWorktreeSetupRunArgs.parse(rawArgs)
    registerWorktreeSetupRun({ ...args, startedAt: now() })
    return { ok: true }
  })
}
