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
  // Connecting apps on an SSH host's own agents; the host's relay writes the files.
  remote: {
    listApps: (call) => ipcRenderer.invoke('marketplaceApps:remote:listApps', call),
    connect: (call) => ipcRenderer.invoke('marketplaceApps:remote:connect', call),
    disconnect: (call) => ipcRenderer.invoke('marketplaceApps:remote:disconnect', call),
    setOpenMetadataToken: (call) =>
      ipcRenderer.invoke('marketplaceApps:remote:setOpenMetadataToken', call),
    addOpenMetadataProfile: (call) =>
      ipcRenderer.invoke('marketplaceApps:remote:addOpenMetadataProfile', call),
    removeOpenMetadataProfile: (call) =>
      ipcRenderer.invoke('marketplaceApps:remote:removeOpenMetadataProfile', call),
    setEngramServer: (call) => ipcRenderer.invoke('marketplaceApps:remote:setEngramServer', call),
    setAccessPolicy: (call) => ipcRenderer.invoke('marketplaceApps:remote:setAccessPolicy', call)
  },
  // Write-only: a token goes to an SSH host's own vault once and is never returned.
  remoteVault: {
    status: (args) => ipcRenderer.invoke('marketplaceApps:remoteVaultStatus', args),
    set: (args) => ipcRenderer.invoke('marketplaceApps:remoteVaultSet', args),
    clear: (args) => ipcRenderer.invoke('marketplaceApps:remoteVaultClear', args)
  }
} satisfies PreloadApi['marketplaceApps']
