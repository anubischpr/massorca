import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const marketplaceEngramOpsApi = {
  getProgram: () => ipcRenderer.invoke('marketplaceEngramOps:getProgram'),
  updateNow: () => ipcRenderer.invoke('marketplaceEngramOps:updateNow'),
  importMemories: () => ipcRenderer.invoke('marketplaceEngramOps:importMemories'),
  listCloudProjects: () => ipcRenderer.invoke('marketplaceEngramOps:listCloudProjects'),
  enrollCloudProject: (args) => ipcRenderer.invoke('marketplaceEngramOps:enrollCloudProject', args),
  syncCloudProject: (args) => ipcRenderer.invoke('marketplaceEngramOps:syncCloudProject', args)
} satisfies PreloadApi['marketplaceEngramOps']
