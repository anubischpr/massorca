import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const marketplaceEngramOpsApi = {
  getProgram: () => ipcRenderer.invoke('marketplaceEngramOps:getProgram'),
  updateNow: () => ipcRenderer.invoke('marketplaceEngramOps:updateNow'),
  importMemories: () => ipcRenderer.invoke('marketplaceEngramOps:importMemories')
} satisfies PreloadApi['marketplaceEngramOps']
