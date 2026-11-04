import { ipcRenderer } from 'electron'
import {
  MARKETPLACE_GIT_PROGRESS_CHANNEL,
  type GitInstallProgress
} from '../../shared/marketplace-install'
import type { PreloadApi } from '../api-types'

export const marketplaceInstallApi = {
  getGitStatus: () => ipcRenderer.invoke('marketplaceInstall:getGitStatus'),
  installGit: () => ipcRenderer.invoke('marketplaceInstall:installGit'),
  adoptGit: () => ipcRenderer.invoke('marketplaceInstall:adoptGit'),
  onGitProgress: (callback: (event: GitInstallProgress) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: GitInstallProgress): void =>
      callback(progress)
    ipcRenderer.on(MARKETPLACE_GIT_PROGRESS_CHANNEL, listener)
    return () => ipcRenderer.removeListener(MARKETPLACE_GIT_PROGRESS_CHANNEL, listener)
  }
} satisfies PreloadApi['marketplaceInstall']
