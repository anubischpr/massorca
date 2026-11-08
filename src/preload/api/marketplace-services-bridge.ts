import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const marketplaceServicesApi = {
  status: () => ipcRenderer.invoke('marketplaceServices:status'),
  connect: (args) => ipcRenderer.invoke('marketplaceServices:connect', args),
  disconnect: (args) => ipcRenderer.invoke('marketplaceServices:disconnect', args)
} satisfies PreloadApi['marketplaceServices']
