import { ipcMain } from 'electron'
import { clearJevApiKey, hasJevApiKey, saveJevApiKey } from '../jev/jev-api-key-store'
import type { JevDecisionsStatus } from '../../shared/jev-decisions-status'

function getStatus(): JevDecisionsStatus {
  return { apiKeyConfigured: hasJevApiKey() }
}

export function registerJevDecisionsHandlers(): void {
  ipcMain.handle('jevDecisions:getStatus', () => getStatus())
  ipcMain.handle('jevDecisions:saveApiKey', (_event, key: unknown) => {
    if (typeof key !== 'string') {
      throw new Error('Jev API key must be a string')
    }
    saveJevApiKey(key)
    return getStatus()
  })
  ipcMain.handle('jevDecisions:clearApiKey', () => {
    clearJevApiKey()
    return getStatus()
  })
}
