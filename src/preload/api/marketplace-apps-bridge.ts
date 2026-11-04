import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const marketplaceAppsApi = {
  listApps: () => ipcRenderer.invoke('marketplaceApps:listApps'),
  connect: (args) => ipcRenderer.invoke('marketplaceApps:connect', args),
  disconnect: (args) => ipcRenderer.invoke('marketplaceApps:disconnect', args),
  setOpenMetadataToken: (args) => ipcRenderer.invoke('marketplaceApps:setOpenMetadataToken', args),
  addOpenMetadataProfile: (args) =>
    ipcRenderer.invoke('marketplaceApps:addOpenMetadataProfile', args),
  removeOpenMetadataProfile: (args) =>
    ipcRenderer.invoke('marketplaceApps:removeOpenMetadataProfile', args),
  setEngramServer: (args) => ipcRenderer.invoke('marketplaceApps:setEngramServer', args),
  setAccessPolicy: (args) => ipcRenderer.invoke('marketplaceApps:setAccessPolicy', args),
  // Write-only: a token goes to an SSH host's own vault once and is never returned.
  remoteVault: {
    status: (args) => ipcRenderer.invoke('marketplaceApps:remoteVaultStatus', args),
    set: (args) => ipcRenderer.invoke('marketplaceApps:remoteVaultSet', args),
    clear: (args) => ipcRenderer.invoke('marketplaceApps:remoteVaultClear', args)
  }
} satisfies PreloadApi['marketplaceApps']
