import type { RpcClient } from '../transport/rpc-client'
import { newTabRepoListRead, type MobileRuntimeRepoSummary } from './mobile-session-read-operations'
import { getRepoIdFromMobileWorktreeId } from './mobile-session-route-helpers'

/**
 * The connection the worktree's repo runs on (an SSH target, say), or null when it runs on the
 * paired host itself. Files written for a chat must land where its agent runs.
 */
export async function readMobileWorktreeConnectionId(
  client: RpcClient,
  worktreeId: string
): Promise<string | null> {
  const repoId = getRepoIdFromMobileWorktreeId(worktreeId)
  const repoResponse = await newTabRepoListRead.request(client)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Preserve the established response shape at this boundary.
  const repos = (newTabRepoListRead.interpret(repoResponse) as MobileRuntimeRepoSummary[]) ?? []
  return repos.find((repo) => repo.id === repoId)?.connectionId?.trim() || null
}
