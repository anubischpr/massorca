import { botTeamHostTarget, currentBotTeamHost } from '@/runtime/bot-team-host'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { toRuntimeWorktreeSelector } from '@/runtime/runtime-worktree-selector'
import type { RuntimeFilePreviewResult } from '../../../../shared/runtime-file-contracts'

function call<TResult>(method: string, params: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
}

/**
 * A team file as the Workspaces viewer reads it: base64 for a binary file (an image or a PDF),
 * the text otherwise. The read `files.read` refuses for binary files (`binary_file`).
 */
export async function readBotTeamFilePreview(
  teamId: string,
  relativePath: string
): Promise<RuntimeFilePreviewResult> {
  const { workspaceId } = await call<{ workspaceId: string | null }>('botTeams.workspace', {
    teamId
  })
  if (workspaceId === null) {
    throw new Error('This team has no folder yet.')
  }
  return call<RuntimeFilePreviewResult>('files.readPreview', {
    worktree: toRuntimeWorktreeSelector(workspaceId),
    relativePath
  })
}
