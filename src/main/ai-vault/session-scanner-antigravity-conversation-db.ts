import { stat } from 'node:fs/promises'
import type SyncDatabase from '../sqlite/sync-database'
import { isSqliteAvailable } from '../sqlite/sync-database'
import { fileUriToFilesystemPath } from '../../shared/file-uri-path'
import { NATIVE_CHAT_VISUALS_DIR_NAME } from '../../shared/native-chat-visuals-folder-layout'
import { DESIGN_SYSTEM_FOLDER } from '../../shared/prototype-design-system-files'
import { isWslUncPath } from '../../shared/wsl-paths'
import { throwIfAiVaultScanCancelled } from './ai-vault-scan-cancellation'
import { antigravityCachePath } from './session-scanner-antigravity-metadata'
import { readOpenCodeDatabase } from './session-scanner-opencode-sqlite-open'

export const ANTIGRAVITY_CONVERSATION_DB_NAME = 'conversation_summaries.db'

// Why: Orca adds these folders to every chat it launches, ahead of the real worktree.
const ORCA_PROFILE_FOLDERS = new Set(['delegation-instructions', NATIVE_CHAT_VISUALS_DIR_NAME])

type ConversationRow = {
  conversationId: unknown
  workspaceUris: unknown
  parentConversationId: unknown
  nestingDepth: unknown
}

/** What the conversation database says about each conversation, keyed by Antigravity's own id. */
export type AntigravityConversationIndex = {
  /** Conversation id to worktree path; ambiguous conversations are omitted. */
  workspaces: Map<string, string>
  /** Conversations an Antigravity agent started for another conversation (not a user chat). */
  subagentIds: Set<string>
}

/**
 * Where the conversation database may sit beside the history file's root. Its folder is not
 * confirmed on every CLI build, so both the root and `cache/` are probed.
 * @param historyPath - The `history.jsonl` path the scan keys its index by.
 * @returns Candidate absolute paths, in probe order.
 */
export function antigravityConversationDbPaths(historyPath: string): string[] {
  const separator = historyPath.includes('\\') ? '\\' : '/'
  const rootPath = historyPath.replace(/[\\/]history\.jsonl$/, '')
  return [
    `${rootPath}${separator}${ANTIGRAVITY_CONVERSATION_DB_NAME}`,
    antigravityCachePath(historyPath, ANTIGRAVITY_CONVERSATION_DB_NAME)
  ]
}

/**
 * Each conversation's workspace and sub-agent flag from Antigravity's conversation database, read
 * with one in-process query per scan. Null when the database is absent, unreadable, or cannot be
 * opened from this host.
 * @param historyPath - The `history.jsonl` path the scan keys its index by.
 * @param signal - The scan's cancellation signal.
 * @returns The conversation index, or null when the database cannot be read.
 */
export async function readLocalAntigravityConversationIndex(
  historyPath: string,
  signal?: AbortSignal
): Promise<AntigravityConversationIndex | null> {
  // Why: SQLite over a WSL UNC share is unsafe; those conversations keep the cache-file fallback.
  if (isWslUncPath(historyPath) || !isSqliteAvailable()) {
    return null
  }
  for (const dbPath of antigravityConversationDbPaths(historyPath)) {
    throwIfAiVaultScanCancelled(signal)
    if (!(await isRegularFile(dbPath))) {
      continue
    }
    try {
      return readOpenCodeDatabase({
        dbPath,
        read: (db) => antigravityIndexFromRows(readConversationRows(db))
      })
    } catch {
      return null
    }
  }
  return null
}

/**
 * The worktree a conversation ran in. Orca's own folders are skipped and the last remaining entry
 * wins, because Orca's profile folders precede the real worktree in the list.
 * @param value - The raw `workspace_uris` cell: a JSON array of file URIs, or one plain path.
 * @returns The worktree path, or null when no usable entry remains.
 */
export function antigravityWorkspaceFromUris(value: unknown): string | null {
  let workspace: string | null = null
  for (const entry of workspaceUriEntries(value)) {
    const path = workspaceUriPath(entry)
    // Why: the shared design system folder is granted after the worktree, so it is last in the list.
    if (path && !isOrcaOwnedFolder(path) && !isSharedDesignSystemFolder(path)) {
      workspace = path
    }
  }
  return workspace
}

function antigravityIndexFromRows(rows: readonly ConversationRow[]): AntigravityConversationIndex {
  const workspaces = new Map<string, string>()
  const ambiguous = new Set<string>()
  const subagentIds = new Set<string>()
  for (const row of rows) {
    const id = typeof row.conversationId === 'string' ? row.conversationId : ''
    if (!id || id.length > 512) {
      continue
    }
    if (isSubagentRow(row)) {
      subagentIds.add(id)
    }
    const path = antigravityWorkspaceFromUris(row.workspaceUris)
    if (!path || ambiguous.has(id)) {
      continue
    }
    const previous = workspaces.get(id)
    if (previous !== undefined && previous !== path) {
      workspaces.delete(id)
      ambiguous.add(id)
      continue
    }
    workspaces.set(id, path)
  }
  return { workspaces, subagentIds }
}

// Why: a user chat has no parent; Antigravity's own sub-agents (jev-worker-inherit, self, ...) carry
// the parent's id and a nesting depth of 1, and their prompt arrives as a system message.
function isSubagentRow(row: ConversationRow): boolean {
  return (
    (typeof row.parentConversationId === 'string' && row.parentConversationId.length > 0) ||
    (typeof row.nestingDepth === 'number' && row.nestingDepth > 0)
  )
}

function readConversationRows(db: SyncDatabase): ConversationRow[] {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
  for (const { name } of tables) {
    if (typeof name !== 'string') {
      continue
    }
    const quoted = `"${name.replace(/"/g, '""')}"`
    const columns = db
      .prepare(`PRAGMA table_info(${quoted})`)
      .all()
      .map((column) => column.name)
    if (columns.includes('conversation_id') && columns.includes('workspace_uris')) {
      // Why: older CLI builds lack the sub-agent columns; select only what the table has.
      const parent = columns.includes('parent_conversation_id') ? 'parent_conversation_id' : "''"
      const depth = columns.includes('nesting_depth') ? 'nesting_depth' : '0'
      return db
        .prepare(
          `SELECT conversation_id AS conversationId, workspace_uris AS workspaceUris, ${parent} AS parentConversationId, ${depth} AS nestingDepth FROM ${quoted}`
        )
        .all()
        .map((row) => ({
          conversationId: row.conversationId,
          workspaceUris: row.workspaceUris,
          parentConversationId: row.parentConversationId,
          nestingDepth: row.nestingDepth
        }))
    }
  }
  return []
}

function workspaceUriEntries(value: unknown): string[] {
  if (typeof value !== 'string') {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === 'string')
    }
    return typeof parsed === 'string' ? [parsed] : []
  } catch {
    return [value]
  }
}

function workspaceUriPath(entry: string): string | null {
  let path: string | null
  if (entry.startsWith('file:')) {
    try {
      path = fileUriToFilesystemPath(new URL(entry))
    } catch {
      return null
    }
  } else {
    path = /^(?:[/\\]|[A-Za-z]:[/\\])/.test(entry) ? entry : null
  }
  return path && path.length <= 4096 ? path : null
}

function isOrcaOwnedFolder(path: string): boolean {
  const segments = path.split(/[\\/]+/)
  return segments.some(
    (segment, index) => segment === 'profile' && ORCA_PROFILE_FOLDERS.has(segments[index + 1] ?? '')
  )
}

function isSharedDesignSystemFolder(path: string): boolean {
  const folder = DESIGN_SYSTEM_FOLDER.split('/')
  const segments = path.split(/[\\/]+/).filter((segment) => segment.length > 0)
  const tail = segments.slice(-folder.length)
  return tail.length === folder.length && tail.every((segment, index) => segment === folder[index])
}

async function isRegularFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}
