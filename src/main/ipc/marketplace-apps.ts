import { ipcMain } from 'electron'
import type { MarketplaceAppsService } from '../marketplace/marketplace-apps-service'
import {
  createRemoteAppsClient,
  type RemoteAppsClient
} from '../marketplace/marketplace-remote-apps-client'
import {
  createRemoteVaultClient,
  type RemoteVaultClient
} from '../marketplace/marketplace-remote-vault-client'
import { getActiveMultiplexer } from '../ssh/ssh-target-registry'

/**
 * `marketplaceApps:<method>`. The service parses every argument and answers `invalid-input` for a
 * bad one; a token only travels renderer to main, never back and never into a log.
 */
export function registerMarketplaceAppsHandlers(
  service: MarketplaceAppsService,
  remoteVault: RemoteVaultClient = createRemoteVaultClient(getActiveMultiplexer),
  remoteApps: RemoteAppsClient = createRemoteAppsClient(getActiveMultiplexer)
): void {
  ipcMain.handle('marketplaceApps:listApps', () => service.listApps())
  ipcMain.handle('marketplaceApps:connect', (_event, args: unknown) => service.connect(args))
  ipcMain.handle('marketplaceApps:disconnect', (_event, args: unknown) => service.disconnect(args))
  ipcMain.handle('marketplaceApps:setOpenMetadataToken', (_event, args: unknown) =>
    service.setOpenMetadataToken(args)
  )
  ipcMain.handle('marketplaceApps:addOpenMetadataProfile', (_event, args: unknown) =>
    service.addOpenMetadataProfile(args)
  )
  ipcMain.handle('marketplaceApps:removeOpenMetadataProfile', (_event, args: unknown) =>
    service.removeOpenMetadataProfile(args)
  )
  ipcMain.handle('marketplaceApps:setEngramServer', (_event, args: unknown) =>
    service.setEngramServer(args)
  )
  ipcMain.handle('marketplaceApps:setAccessPolicy', (_event, args: unknown) =>
    service.setAccessPolicy(args)
  )
  ipcMain.handle('marketplaceApps:remoteVaultStatus', (_event, args: unknown) =>
    remoteVault.status(args)
  )
  ipcMain.handle('marketplaceApps:remoteVaultSet', (_event, args: unknown) => remoteVault.set(args))
  ipcMain.handle('marketplaceApps:remoteVaultClear', (_event, args: unknown) =>
    remoteVault.clear(args)
  )
  // Why: an SSH host's agents are edited by that host's own relay; main only carries the call.
  ipcMain.handle('marketplaceApps:remote:listApps', (_event, args: unknown) =>
    remoteApps.listApps(args)
  )
  ipcMain.handle('marketplaceApps:remote:connect', (_event, args: unknown) =>
    remoteApps.connect(args)
  )
  ipcMain.handle('marketplaceApps:remote:disconnect', (_event, args: unknown) =>
    remoteApps.disconnect(args)
  )
  ipcMain.handle('marketplaceApps:remote:setOpenMetadataToken', (_event, args: unknown) =>
    remoteApps.setOpenMetadataToken(args)
  )
  ipcMain.handle('marketplaceApps:remote:addOpenMetadataProfile', (_event, args: unknown) =>
    remoteApps.addOpenMetadataProfile(args)
  )
  ipcMain.handle('marketplaceApps:remote:removeOpenMetadataProfile', (_event, args: unknown) =>
    remoteApps.removeOpenMetadataProfile(args)
  )
  ipcMain.handle('marketplaceApps:remote:setEngramServer', (_event, args: unknown) =>
    remoteApps.setEngramServer(args)
  )
  ipcMain.handle('marketplaceApps:remote:setAccessPolicy', (_event, args: unknown) =>
    remoteApps.setAccessPolicy(args)
  )
}
