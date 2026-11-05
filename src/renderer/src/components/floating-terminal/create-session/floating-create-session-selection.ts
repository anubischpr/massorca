import {
  buildDefaultCreateChatSelection,
  chooseCreateChatLocation,
  type CreateChatOptions,
  type CreateChatSelection
} from '@/components/create-chat/create-chat-selection'
import { FLOATING_HOST_THIS_COMPUTER } from '@/lib/floating-workspace-host'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host'

/** The floating header's host as the composer names it: a paired host is a runtime environment. */
function floatingHostExecutionHostId(selectedHost: string): ExecutionHostId {
  return selectedHost === FLOATING_HOST_THIS_COMPUTER
    ? LOCAL_EXECUTION_HOST_ID
    : toRuntimeExecutionHostId(selectedHost)
}

/** The composer's defaults, moved to the floating panel's host and the workspace it starts sessions in. */
export function floatingCreateChatSelection(
  options: CreateChatOptions,
  host: { selectedHost: string; remoteWorkspaceId: string | null }
): CreateChatSelection {
  const defaults = buildDefaultCreateChatSelection(options)
  const workspace = host.remoteWorkspaceId
    ? options.worktrees?.find((worktree) => worktree.worktreeId === host.remoteWorkspaceId)
    : undefined
  if (workspace) {
    return {
      ...defaults,
      executionHostId: workspace.hostId,
      project: { kind: 'repo', repoId: workspace.repoId },
      workspaceMode: 'existing-worktree',
      existingWorktreeId: workspace.worktreeId
    }
  }
  const hostId = floatingHostExecutionHostId(host.selectedHost)
  return hostId === defaults.executionHostId
    ? defaults
    : chooseCreateChatLocation(defaults, hostId, options.repos)
}
