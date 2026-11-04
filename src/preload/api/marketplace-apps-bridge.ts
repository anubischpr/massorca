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
  setEngramServer: (args) => ipcRenderer.invoke('marketplaceApps:setEngramServer', args)
} satisfies PreloadApi['marketplaceApps']
