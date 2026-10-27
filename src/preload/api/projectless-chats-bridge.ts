import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const projectlessChatsApi = {
  createWorkspace: (args) => ipcRenderer.invoke('projectlessChats:createWorkspace', args)
} satisfies PreloadApi['projectlessChats']
