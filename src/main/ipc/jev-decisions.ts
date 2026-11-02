import { ipcMain } from 'electron'
import { clearJevApiKey, readJevApiKeyStatus, saveJevApiKey } from '../jev/jev-api-key-store'

export function registerJevDecisionsHandlers(): void {
  ipcMain.handle('jevDecisions:getStatus', () => readJevApiKeyStatus())
  ipcMain.handle('jevDecisions:saveApiKey', (_event, key: unknown) => {
    if (typeof key !== 'string') {
      throw new Error('Jev API key must be a string')
    }
    saveJevApiKey(key)
    return readJevApiKeyStatus()
  })
  ipcMain.handle('jevDecisions:clearApiKey', () => {
    clearJevApiKey()
    return readJevApiKeyStatus()
  })
}
