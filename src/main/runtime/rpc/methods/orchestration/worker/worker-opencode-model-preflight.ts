import {
  prepareFederationConfiguredWorkerStart,
  resolveWorkerConfiguredAgentParams
} from './worker-configured-agent-preflight'
import type { prepareFederationAttachmentWorkerStart } from './worker-start-validation'
import type { OrcaRuntimeService } from '../../../../orca-runtime'
import type { OrchestrationSessionCaller } from '../../../../orchestration/orchestration-caller-identity'
import { resolveDispatchCallerWorktreeId } from '../../orchestration-caller-workspace'

export async function probeWorkerOpenCodeModelLaunchSupport(
  runtime: OrcaRuntimeService,
  params: { agent?: string; model?: string },
  target: { worktree?: string }
): Promise<boolean> {
  return Boolean(
    params.model &&
    params.agent &&
    runtime.resolveOrchestrationAgentLauncher(params.agent) === 'opencode' &&
    (await runtime.probeOrchestrationOpenCodeModelLaunchSupport({ ...target, model: params.model }))
  )
}

/** A local OpenCode worker takes its model only in an existing worktree the caller names. */
export async function resolveLocalOpenCodeModelLaunchSupport(
  runtime: OrcaRuntimeService,
  launchParams: { agent?: string; model?: string },
  params: { from: string; worktree?: string },
  callerSession: OrchestrationSessionCaller | undefined
): Promise<boolean> {
  const requestedWorktree = params.worktree ?? 'current'
  const createsWorktree = requestedWorktree === 'new-child' || requestedWorktree === 'new-top-level'
  if (createsWorktree || launchParams.agent !== 'opencode' || !launchParams.model) {
    return false
  }
  const callerWorkspaceId = await resolveDispatchCallerWorktreeId(
    runtime,
    params.from,
    callerSession
  )
  return probeWorkerOpenCodeModelLaunchSupport(runtime, launchParams, {
    worktree: requestedWorktree === 'current' ? `id:${callerWorkspaceId}` : requestedWorktree
  })
}

export async function prepareFederationWorkerLaunchOnHost(
  args: Omit<
    Parameters<typeof prepareFederationAttachmentWorkerStart>[0],
    'openCodeModelLaunchSupported'
  >
) {
  const params = await resolveWorkerConfiguredAgentParams(args.runtime, args.params, async () =>
    args.createsWorktree ? { repo: args.params.repo } : { worktree: args.params.worktree }
  )
  const openCodeModelLaunchSupported =
    !args.createsWorktree &&
    (await probeWorkerOpenCodeModelLaunchSupport(args.runtime, params, {
      worktree: params.worktree
    }))
  return prepareFederationConfiguredWorkerStart({ ...args, params, openCodeModelLaunchSupported })
}
