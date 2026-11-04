import { ipcMain } from 'electron'
import { createDefaultEngramOpsService } from '../marketplace/engram-ops/engram-ops-defaults'
import type { EngramOpsService } from '../marketplace/engram-ops/engram-ops-service'

/** `marketplaceEngramOps:<method>`; results carry versions and counts, never memory contents. */
export function registerMarketplaceEngramOpsHandlers(
  service: EngramOpsService = createDefaultEngramOpsService()
): void {
  ipcMain.handle('marketplaceEngramOps:getProgram', () => service.getProgram())
  ipcMain.handle('marketplaceEngramOps:updateNow', () => service.updateNow())
  ipcMain.handle('marketplaceEngramOps:importMemories', () => service.importMemories())
}
