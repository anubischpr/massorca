import type { BotTeamProjectFiles } from '../../../shared/rpc-contract/bot-team-files-project-params'
import type {
  RuntimeFilePreviewResult,
  RuntimeFileReadResult
} from '../../../shared/runtime-file-contracts'
import { botTeamHostTarget, currentBotTeamHost } from './bot-team-host'
import { callRuntimeRpc } from './runtime-rpc-client'
import { RuntimeRpcCallError } from './runtime-rpc-result'
import { toRuntimeWorktreeSelector } from './runtime-worktree-selector'

// Same host as every other Bot teams call; the project's files sit beside the team on that host.
function call<TResult>(method: string, params?: unknown): Promise<TResult> {
  return callRuntimeRpc<TResult>(botTeamHostTarget(currentBotTeamHost()), method, params)
}

/** A host from before linked project files lacks the method: the answer is 'unavailable', not a failure. */
async function orUnavailable<TResult>(
  read: () => Promise<TResult>
): Promise<TResult | 'unavailable'> {
  try {
    return await read()
  } catch (error) {
    if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
      return 'unavailable'
    }
    throw error
  }
}

/** The files a team's bot tasks changed in its linked projects, each where it is. */
export function listBotTeamProjectFiles(
  teamId: string
): Promise<BotTeamProjectFiles | 'unavailable'> {
  return orUnavailable(() => call<BotTeamProjectFiles>('botTeams.projectFiles', { teamId }))
}

/** A project file as text, read in the workspace it is in, on the team's host. */
export function readBotTeamProjectFile(
  workspaceId: string,
  relativePath: string
): Promise<RuntimeFileReadResult> {
  return call<RuntimeFileReadResult>('files.read', {
    worktree: toRuntimeWorktreeSelector(workspaceId),
    relativePath
  })
}

/** A project file's preview, read in the workspace it is in: base64 for a binary file. */
export function readBotTeamProjectFilePreview(
  workspaceId: string,
  relativePath: string
): Promise<RuntimeFilePreviewResult> {
  return call<RuntimeFilePreviewResult>('files.readPreview', {
    worktree: toRuntimeWorktreeSelector(workspaceId),
    relativePath
  })
}
