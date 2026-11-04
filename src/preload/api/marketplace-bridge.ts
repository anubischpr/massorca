import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const marketplaceApi = {
  detect: () => ipcRenderer.invoke('marketplace:detect'),
  setEngramMcp: (args) => ipcRenderer.invoke('marketplace:setEngramMcp', args)
} satisfies PreloadApi['marketplace']
