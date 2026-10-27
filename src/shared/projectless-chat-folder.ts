import type { FolderWorkspace, WorkspaceKey } from './folder-workspace-types'

const MAX_CHAT_SLUG_LENGTH = 40
const FALLBACK_CHAT_SLUG = 'chat'

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

/** Lowercase ASCII kebab-case, diacritics folded; non-Latin titles fall back to `chat`. */
export function slugifyChatTitle(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX_CHAT_SLUG_LENGTH)
    .replace(/-+$/, '')
  return slug || FALLBACK_CHAT_SLUG
}

/** Local calendar day, not UTC, so a chat started at 00:30 lands in the day the user sees. */
export function formatChatDateFolder(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `[<date>, <slug>]` for a 1-based collision attempt: `slug`, then `slug-2`, `slug-3`, ... */
export function projectlessChatFolderSegments(
  date: Date,
  title: string,
  attempt = 1
): readonly [string, string] {
  const slug = slugifyChatTitle(title)
  return [formatChatDateFolder(date), attempt <= 1 ? slug : `${slug}-${attempt}`]
}
