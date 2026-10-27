import type { FolderWorkspace, WorkspaceKey } from './folder-workspace-types'

// Why: lowercase letters and digits only, so the id is a safe folder name on every platform.
const CHAT_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
const CHAT_ID_LENGTH = 6

export type ProjectlessChatWorkspaceErrorCode =
  | 'ssh_location_unsupported'
  | 'web_runtime_unsupported'

export type ProjectlessChatWorkspaceResult =
  | {
      ok: true
      workspaceKey: WorkspaceKey
      workspace: FolderWorkspace
      folderPath: string
    }
  | { ok: false; code: ProjectlessChatWorkspaceErrorCode }

/** A short folder-safe id for a new chat; the caller retries on a name collision. */
export function createProjectlessChatId(random: () => number = Math.random): string {
  let id = ''
  for (let index = 0; index < CHAT_ID_LENGTH; index += 1) {
    id += CHAT_ID_ALPHABET[Math.floor(random() * CHAT_ID_ALPHABET.length)]
  }
  return id
}

/** Local calendar day, not UTC, so a chat started at 00:30 lands in the day the user sees. */
export function formatChatDateFolder(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `[<date>, <chat id>]`: the folder path under the projectless root for one chat. */
export function projectlessChatFolderSegments(
  date: Date,
  chatId: string
): readonly [string, string] {
  return [formatChatDateFolder(date), chatId]
}
