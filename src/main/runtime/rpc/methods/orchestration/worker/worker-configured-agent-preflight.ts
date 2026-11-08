import type { OrcaRuntimeService } from '../../../../orca-runtime'
import { isTuiAgent } from '../../../../../../shared/tui-agent-config'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'
import { prepareFederationAttachmentWorkerStart } from './worker-start-validation'
import { resolveDispatchCallerWorktreeId } from '../../orchestration-caller-workspace'

type WorkerAgentTarget = { repo?: string; worktree?: string }

/** Where a configured agent alias is resolved: the caller's repo for a new worktree, else the worktree itself. */
export function callerWorkerAgentTarget(args: {
  runtime: OrcaRuntimeService
  params: { from: string; repo?: string }
  callerSession: Parameters<typeof resolveDispatchCallerWorktreeId>[2]
  createsWorktree: boolean
  requestedWorktree: string
}): () => Promise<WorkerAgentTarget> {
  const { runtime, params, callerSession, createsWorktree, requestedWorktree } = args
  return async () => {
    const callerWorkspaceId = await resolveDispatchCallerWorktreeId(
      runtime,
      params.from,
      callerSession
    )
    const parent = createsWorktree
      ? await runtime.showManagedWorktree(`id:${callerWorkspaceId}`)
      : undefined
    return createsWorktree
      ? { repo: params.repo ?? parent?.repoId }
      : {
          worktree: requestedWorktree === 'current' ? `id:${callerWorkspaceId}` : requestedWorktree
        }
  }
}

export async function resolveWorkerConfiguredAgentParams<T extends { agent?: string }>(
  runtime: OrcaRuntimeService,
  params: T,
  resolveTarget: () => Promise<WorkerAgentTarget>
): Promise<T> {
  if (!params.agent || isTuiAgent(params.agent)) {
    return params
  }
  const agent = await runtime.resolveOrchestrationAgentLauncherForTarget(
    params.agent,
    await resolveTarget()
  )
  if (!agent) {
    throw new OrchestrationError(
      'agent_unconfigured',
      'A configured single-executable agent alias is required.'
    )
  }
  return { ...params, agent }
}

export async function prepareFederationConfiguredWorkerStart(
  args: Parameters<typeof prepareFederationAttachmentWorkerStart>[0]
) {
  const params = await resolveWorkerConfiguredAgentParams(args.runtime, args.params, async () =>
    args.createsWorktree ? { repo: args.params.repo } : { worktree: args.params.worktree }
  )
  return prepareFederationAttachmentWorkerStart({ ...args, params })
}
