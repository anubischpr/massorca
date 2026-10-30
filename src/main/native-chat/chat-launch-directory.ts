import type { AgentSessionRecord } from '../../shared/agent-session-record'

/**
 * Where a local chat works. Why the workspace fallback: only a floating workspace's record pins a launch
 * directory, so a worktree or folder chat has none and is found through its workspace.
 */
export async function launchDirectoryOfChat(
  record: Pick<AgentSessionRecord, 'location' | 'launchDirectory'>,
  resolveWorkspacePath: ((workspaceId: string) => Promise<string>) | undefined
): Promise<string | undefined> {
  if (record.launchDirectory !== undefined) {
    return record.launchDirectory
  }
  return resolveWorkspacePath?.(record.location.workspaceId).catch(() => undefined)
}
