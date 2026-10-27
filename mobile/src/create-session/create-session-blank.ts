import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import { createBlankWorkspace } from '../tasks/blank-workspace-create'
import type { WorktreeCreateIdempotencyProbe } from '../tasks/worktree-create-idempotency-policy'
import type { RpcClient } from '../transport/rpc-client'
import { readCreatureName, readPrimaryWorkspaceId } from './create-session-launch'
import type { CreateSessionLaunchResult } from './create-session-launch'
import type { CreateSessionWorkspaceMode } from './create-session-model'

/**
 * The "Blank terminal" path of the more-options sheet: a shell with no agent. A new worktree goes
 * through the same blank create the old form uses; the current checkout (and a folder) already has
 * its workspace, so nothing is created. Never throws.
 */
export async function launchBlankTerminal(args: {
  client: RpcClient
  hostId: string
  repo: MobileWorkspaceRepo
  workspaceMode: CreateSessionWorkspaceMode
  worktreeCreateIdempotency: WorktreeCreateIdempotencyProbe
}): Promise<CreateSessionLaunchResult> {
  const { client, hostId, repo } = args
  try {
    if (args.workspaceMode === 'current-checkout') {
      return {
        ok: true,
        worktreeId: await readPrimaryWorkspaceId(client, hostId, repo),
        name: repo.displayName
      }
    }
    const created = await createBlankWorkspace({
      client,
      repoId: repo.id,
      baseName: await readCreatureName(client, hostId, repo.id),
      nameWasGenerated: true,
      createdWithAgentId: undefined,
      comment: undefined,
      // Why: the host setup policy decides, so nothing untrusted runs from a phone tap.
      setupDecision: 'inherit',
      worktreeCreateIdempotency: args.worktreeCreateIdempotency,
      agentLaunchSupported: false
    })
    if ('error' in created) {
      return { ok: false, message: created.error }
    }
    return {
      ok: true,
      worktreeId: created.worktreeId,
      name: created.name,
      ...(created.warning ? { warning: created.warning } : {})
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() : ''
    return { ok: false, message: message || 'Failed to create workspace' }
  }
}
