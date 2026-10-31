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

/**
 * The directory that names a chat's project for the Prototypes list. Once the chat's worktree is removed its
 * workspace no longer resolves, so the repository's own path answers instead: the project, and the design
 * system that lives at its main checkout, outlive every worktree.
 */
export async function projectDirectoryOfChat(
  record: Pick<AgentSessionRecord, 'location' | 'launchDirectory'>,
  resolveWorkspacePath: ((workspaceId: string) => Promise<string>) | undefined,
  resolveRepositoryPath: ((workspaceId: string) => Promise<string | undefined>) | undefined
): Promise<string | undefined> {
  return (
    (await launchDirectoryOfChat(record, resolveWorkspacePath)) ??
    (await resolveRepositoryPath?.(record.location.workspaceId).catch(() => undefined))
  )
}
