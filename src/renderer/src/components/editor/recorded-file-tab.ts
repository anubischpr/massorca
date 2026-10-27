import { basename } from '@/lib/path'

/** A file the chat's agent saved outside a paired host's worktree, shown read-only in a tab. */
export type RecordedFileTabState = {
  sessionId: string
  /** The host's absolute path, exactly as the agent's write recorded it. */
  path: string
  worktreePath: string
  /** The chat's own host: the global active runtime may be another one, or none. */
  runtimeEnvironmentId: string | null
}

// Why: one tab per chat and path, so opening the link again activates the tab instead of stacking copies.
export function buildRecordedFileTabId(
  worktreeId: string,
  file: Pick<RecordedFileTabState, 'sessionId' | 'path'>
): string {
  return `${worktreeId}::recorded-file::${file.sessionId}::${file.path}`
}

export function getRecordedFileTabLabel(path: string): string {
  return basename(path)
}
