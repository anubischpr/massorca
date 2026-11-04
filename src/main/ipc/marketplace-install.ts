import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  MARKETPLACE_GIT_PROGRESS_CHANNEL,
  type GitInstallProgress
} from '../../shared/marketplace-install'
import { createLocalGitInstallEnv } from '../marketplace/install/git-install-env'
import {
  createGitInstallService,
  type GitInstallService
} from '../marketplace/install/git-install-service'

// Why the sender only: progress belongs to the window that started the install.
function progressSink(event: IpcMainInvokeEvent): (progress: GitInstallProgress) => void {
  return (progress) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send(MARKETPLACE_GIT_PROGRESS_CHANNEL, progress)
    }
  }
}

export function registerMarketplaceInstallHandlers(
  service: GitInstallService = createGitInstallService(createLocalGitInstallEnv())
): void {
  ipcMain.handle('marketplaceInstall:getGitStatus', () => service.status())
  ipcMain.handle('marketplaceInstall:installGit', (event) => service.install(progressSink(event)))
  ipcMain.handle('marketplaceInstall:adoptGit', (event) => service.adopt(progressSink(event)))
}
