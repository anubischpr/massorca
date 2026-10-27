import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import type { Store } from '../../persistence'
import type { ProjectlessChatWorkspaceResult } from '../../../shared/projectless-chat-folder'
import { createProjectlessChatWorkspace } from '../../projectless-chats/projectless-chat-workspace'
import { getSshFilesystemProvider } from '../../providers/ssh-filesystem-dispatch'
import { notifyReposChanged } from './repos-changed-notification'
import {
  ProjectlessChatCreateWorkspaceArgs,
  parseProjectGroupIpcArgs
} from './repo-ipc-arg-schemas'

export function registerProjectlessChatHandlers(
  mainWindow: BrowserWindow,
  store: Store,
  options: { now?: () => Date } = {}
): void {
  ipcMain.handle(
    'projectlessChats:createWorkspace',
    async (_event, rawArgs: unknown): Promise<ProjectlessChatWorkspaceResult> => {
      const args = parseProjectGroupIpcArgs(
        ProjectlessChatCreateWorkspaceArgs,
        rawArgs ?? {},
        'invalid_projectless_chat_create_args'
      )
      const result = await createProjectlessChatWorkspace({
        store,
        createdWithAgent: args.createdWithAgent,
        createChatNaming: args.createChatNaming,
        connectionId: args.connectionId ?? null,
        now: options.now?.() ?? new Date(),
        pathStatusDeps: { getSshFilesystemProvider }
      })
      if (result.ok) {
        notifyReposChanged(mainWindow)
      }
      return result
    }
  )
}
