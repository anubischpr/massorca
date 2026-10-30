// Whether a prototype set's chat or worktree is gone, which is the only time the host lets its folder be deleted.

import { stat } from 'node:fs/promises'
import type { AgentSessionRecord } from '../../shared/agent-session-record'
import { launchDirectoryOfChat } from './chat-launch-directory'

/**
 * True when a chat this host runs locally has no working directory any more: no record is the caller's call, and
 * a remote chat is never gone here, since losing contact with its host proves nothing. A directory that cannot be
 * read for another reason (permissions, I/O) is not gone either.
 */
export async function isLocalChatWorkingDirectoryGone(
  record: Pick<AgentSessionRecord, 'location' | 'launchDirectory'>,
  resolveWorkspacePath: ((workspaceId: string) => Promise<string>) | undefined
): Promise<boolean> {
  // Why: with neither a pinned directory nor a resolver there is nothing to look at, so nothing is gone.
  if (record.launchDirectory === undefined && resolveWorkspacePath === undefined) {
    return false
  }
  const directory = await launchDirectoryOfChat(record, resolveWorkspacePath)
  // Why: a local workspace the host no longer resolves is a worktree that was removed.
  if (directory === undefined) {
    return true
  }
  try {
    return !(await stat(directory)).isDirectory()
  } catch (error) {
    return hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}
