import { ipcMain } from 'electron'
import { createDefaultEngramOpsService } from '../marketplace/engram-ops/engram-ops-defaults'
import type { EngramOpsService } from '../marketplace/engram-ops/engram-ops-service'

function projectNameFrom(args: unknown): string {
  if (
    typeof args === 'object' &&
    args !== null &&
    'name' in args &&
    typeof args.name === 'string'
  ) {
    return args.name
  }
  return ''
}

/** `marketplaceEngramOps:<method>`; results carry versions, counts and project names, never memory contents. */
export function registerMarketplaceEngramOpsHandlers(
  service: EngramOpsService = createDefaultEngramOpsService()
): void {
  ipcMain.handle('marketplaceEngramOps:getProgram', () => service.getProgram())
  ipcMain.handle('marketplaceEngramOps:updateNow', () => service.updateNow())
  ipcMain.handle('marketplaceEngramOps:importMemories', () => service.importMemories())
  ipcMain.handle('marketplaceEngramOps:listCloudProjects', () => service.listCloudProjects())
  ipcMain.handle('marketplaceEngramOps:enrollCloudProject', (_event, args: unknown) =>
    service.enrollCloudProject(projectNameFrom(args))
  )
  ipcMain.handle('marketplaceEngramOps:syncCloudProject', (_event, args: unknown) =>
    service.syncCloudProject(projectNameFrom(args))
  )
}
