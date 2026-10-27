import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const worktreeSetupRunsApi = {
  register: (args) => ipcRenderer.invoke('worktreeSetupRuns:register', args),
  bindSession: (args) => ipcRenderer.invoke('worktreeSetupRuns:bindSession', args),
  worktreeIdFor: (args) => ipcRenderer.invoke('worktreeSetupRuns:worktreeIdFor', args)
} satisfies PreloadApi['worktreeSetupRuns']
