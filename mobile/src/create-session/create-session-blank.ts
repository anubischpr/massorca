import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import { AGENT_LAUNCH_UNCONFIRMED_MESSAGE } from '../session/mobile-existing-agent-launch'
import { createBlankWorkspace } from '../tasks/blank-workspace-create'
import type { WorktreeCreateIdempotencyProbe } from '../tasks/worktree-create-idempotency-policy'
import { isRpcDeliveryUnknown } from '../transport/rpc-delivery-ambiguity'
import type { RpcClient } from '../transport/rpc-client'
import { readCreatureName, readPrimaryWorkspaceId } from './create-session-launch'
import type { CreateSessionLaunchResult, CreateSessionLaunchSetup } from './create-session-launch'
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
  setup: CreateSessionLaunchSetup
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
      setupDecision: args.setup.decision,
      worktreeCreateIdempotency: args.worktreeCreateIdempotency,
      agentLaunchSupported: false
    })
    if ('error' in created) {
      return { ok: false, message: created.error }
    }
    const warning = [created.warning, args.setup.notice].filter(Boolean).join(' ')
    return {
      ok: true,
      worktreeId: created.worktreeId,
      name: created.name,
      ...(warning ? { warning } : {})
    }
  } catch (error) {
    if (isRpcDeliveryUnknown(error)) {
      return { ok: false, message: AGENT_LAUNCH_UNCONFIRMED_MESSAGE }
    }
    const message = error instanceof Error ? error.message.trim() : ''
    return { ok: false, message: message || 'Failed to create workspace' }
  }
}
