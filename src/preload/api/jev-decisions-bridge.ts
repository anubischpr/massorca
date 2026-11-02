import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import type { JevDecisionsStatus } from '../../shared/jev-decisions-status'

export const jevDecisionsApi = {
  getStatus: (): Promise<JevDecisionsStatus> => ipcRenderer.invoke('jevDecisions:getStatus'),
  saveApiKey: (key: string): Promise<JevDecisionsStatus> =>
    ipcRenderer.invoke('jevDecisions:saveApiKey', key),
  clearApiKey: (): Promise<JevDecisionsStatus> => ipcRenderer.invoke('jevDecisions:clearApiKey')
} satisfies PreloadApi['jevDecisions']
