import { ipcMain } from 'electron'
import { z } from 'zod'
import {
  bindWorktreeSetupRunsToSession,
  registerWorktreeSetupRun,
  worktreeSetupRunWorktreeId
} from '../worktree-setup/setup-run-registry'

const RegisterWorktreeSetupRunArgs = z.object({
  ptyId: z.string().min(1),
  worktreeId: z.string().min(1)
})

const WorktreeSetupRunPtyArgs = z.object({
  ptyId: z.string().min(1)
})

const BindWorktreeSetupRunsArgs = z.object({
  worktreeId: z.string().min(1),
  sessionId: z.string().min(1)
})

export function registerWorktreeSetupRunHandlers(now: () => number = Date.now): void {
  ipcMain.handle('worktreeSetupRuns:register', (_event, rawArgs: unknown) => {
    const args = RegisterWorktreeSetupRunArgs.parse(rawArgs)
    registerWorktreeSetupRun({ ...args, startedAt: now() })
    return { ok: true }
  })
  ipcMain.handle('worktreeSetupRuns:bindSession', (_event, rawArgs: unknown) => {
    bindWorktreeSetupRunsToSession(BindWorktreeSetupRunsArgs.parse(rawArgs))
    return { ok: true }
  })
  ipcMain.handle('worktreeSetupRuns:worktreeIdFor', (_event, rawArgs: unknown) => {
    const { ptyId } = WorktreeSetupRunPtyArgs.parse(rawArgs)
    return { worktreeId: worktreeSetupRunWorktreeId(ptyId) }
  })
}
