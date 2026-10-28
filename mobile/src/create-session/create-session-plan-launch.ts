import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import type { AgentLaunchSupport } from '../tasks/agent-launch-request'
import type { WorktreeCreateIdempotencyProbe } from '../tasks/worktree-create-idempotency-policy'
import type { RpcClient } from '../transport/rpc-client'
import { launchGentleShellSession } from './create-session-gentle-shell-launch'
import {
  launchCreateSession,
  type CreateSessionLaunchResult,
  type CreateSessionLaunchSetup
} from './create-session-launch'
import type { CreateSessionLaunchPlan } from './create-session-launch-plan'

export type CreateSessionPlanLaunchArgs = {
  client: RpcClient
  hostId: string
  repo: MobileWorkspaceRepo
  plan: CreateSessionLaunchPlan
  setup: CreateSessionLaunchSetup
  agentLaunchSupport: Promise<AgentLaunchSupport | false>
  worktreeCreateIdempotency: WorktreeCreateIdempotencyProbe
}

/**
 * Starts a plan's chat. A Gentle Shell plan takes the structured create, since `agent.launch` cannot
 * name a Pi runtime; every other plan keeps `agent.launch`.
 */
export function launchCreateSessionPlan(
  args: CreateSessionPlanLaunchArgs
): Promise<CreateSessionLaunchResult> {
  return args.plan.piRuntime === 'gentle-shell'
    ? launchGentleShellSession(args)
    : launchCreateSession(args)
}
