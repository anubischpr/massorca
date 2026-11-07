import { ipcMain } from 'electron'
import {
  connectMarketplaceService,
  disconnectMarketplaceService,
  readMarketplaceServices
} from '../marketplace/marketplace-services'
import { getMarketplaceVault, type MarketplaceVault } from '../marketplace/marketplace-vault'

/**
 * `marketplaceServices:<method>` for this computer. Every argument is parsed in the service and a
 * bad one answers `invalid-input`; a token only travels renderer to main, never back or into a log.
 */
export function registerMarketplaceServicesHandlers(
  vault: () => MarketplaceVault = getMarketplaceVault
): void {
  ipcMain.handle('marketplaceServices:status', () => readMarketplaceServices(vault()))
  ipcMain.handle('marketplaceServices:connect', (_event, args: unknown) =>
    connectMarketplaceService(vault(), args)
  )
  ipcMain.handle('marketplaceServices:disconnect', (_event, args: unknown) =>
    disconnectMarketplaceService(vault(), args)
  )
}
