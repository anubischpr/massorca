import { ipcMain } from 'electron'
import type { MarketplaceAppsService } from '../marketplace/marketplace-apps-service'

/**
 * `marketplaceApps:<method>`. The service parses every argument and answers `invalid-input` for a
 * bad one; a token only travels renderer to main, never back and never into a log.
 */
export function registerMarketplaceAppsHandlers(service: MarketplaceAppsService): void {
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
}
