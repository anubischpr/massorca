import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const worktreeSetupRunsApi = {
  register: (args) => ipcRenderer.invoke('worktreeSetupRuns:register', args)
} satisfies PreloadApi['worktreeSetupRuns']
