import { ipcRenderer } from 'electron'
import type { MarketplaceCustomInstallEvent } from '../../shared/marketplace-custom'
import type { PreloadApi } from '../api-types'

export const marketplaceCustomApi = {
  list: () => ipcRenderer.invoke('marketplaceCustom:list'),
  add: (args) => ipcRenderer.invoke('marketplaceCustom:add', args),
  remove: (args) => ipcRenderer.invoke('marketplaceCustom:remove', args),
  install: (args) => ipcRenderer.invoke('marketplaceCustom:install', args),
  onInstallEvent: (callback) => {
    const listener = (_event: unknown, payload: MarketplaceCustomInstallEvent): void =>
      callback(payload)
    ipcRenderer.on('marketplaceCustom:installEvent', listener)
    return () => {
      ipcRenderer.removeListener('marketplaceCustom:installEvent', listener)
    }
  }
} satisfies PreloadApi['marketplaceCustom']
