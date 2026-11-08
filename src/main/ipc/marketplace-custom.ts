import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { MarketplaceCustomInstallEvent } from '../../shared/marketplace-custom'
import { createLocalCustomItemEnv } from '../marketplace/custom/custom-item-env'
import {
  createCustomItemService,
  type CustomItemService
} from '../marketplace/custom/custom-item-service'

/** IPC event the main process sends to the window that started an install. */
export const MARKETPLACE_CUSTOM_INSTALL_EVENT_CHANNEL = 'marketplaceCustom:installEvent'

// Why the sender only: install progress belongs to the window that started the install.
function installEventSink(
  event: IpcMainInvokeEvent
): (payload: MarketplaceCustomInstallEvent) => void {
  return (payload) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send(MARKETPLACE_CUSTOM_INSTALL_EVENT_CHANNEL, payload)
    }
  }
}

/**
 * `marketplaceCustom:<method>`. The service parses every argument and answers `invalid-input` for
 * a bad one, so nothing reaches the store or a process unchecked.
 */
export function registerMarketplaceCustomHandlers(
  service: CustomItemService = createCustomItemService(createLocalCustomItemEnv())
): void {
  ipcMain.handle('marketplaceCustom:list', () => service.list())
  ipcMain.handle('marketplaceCustom:add', (_event, args: unknown) => service.add(args))
  ipcMain.handle('marketplaceCustom:remove', (_event, args: unknown) => service.remove(args))
  ipcMain.handle('marketplaceCustom:install', (event, args: unknown) =>
    service.install(args, installEventSink(event))
  )
}
