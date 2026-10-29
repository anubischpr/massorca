/**
 * The access a structured worker runs in, from the mode its caller asked for and the modes its agent
 * declares. A worker never runs wider than it was asked to: a mode the agent cannot apply narrows to
 * the safest declared one, and when no declared mode is that narrow the start is refused.
 */

import {
  agentSessionDeclaredAccess,
  type AgentSessionAccessModeValue,
  type AgentSessionDeclaredAccess,
  type AgentSessionExplicitAccess
} from '../../../../../../shared/agent-session-access-mode'
import type { TuiAgent } from '../../../../../../shared/tui-agent'
import { structuredAgentRuntimeRegistration } from '../../../../structured-agent-runtime-registrations'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'
import type { WorkerStartModeReceipt } from '../../orchestration-worker-start-mode'

/** How freely a mode lets the agent act without asking; a fallback never outranks the request. */
const PERMISSIVENESS: Record<AgentSessionExplicitAccess, number> = {
  'read-only': 0,
  plan: 1,
  default: 2,
  auto: 3,
  'accept-edits': 3,
  'full-access': 4
}

/**
 * An explicit access mode is applied only by a structured worker this start creates on this host.
 * A reused terminal or chat keeps its own access, and a remote worker runs as a terminal agent.
 */
export function assertWorkerStartAccessModeApplies(args: {
  requested: AgentSessionAccessModeValue | undefined
  terminal?: string
  on?: string
}): void {
  if (args.requested === undefined || args.requested === 'inherit') {
    return
  }
  if (args.terminal) {
    throw new OrchestrationError(
      'invalid_argument',
      '--access-mode cannot be applied when reusing an existing terminal or chat.',
      { effectsApplied: false }
    )
  }
  if (args.on) {
    throw new OrchestrationError(
      'capability_unsupported',
      '--access-mode cannot be applied on another server, whose workers run as terminal agents. Omit --on or --access-mode.',
      { effectsApplied: false }
    )
  }
}

/** The modes a structured agent declares, at the agent level; Gentle Shell's own are not read here. */
export function declaredAccessForStructuredAgent(
  agent: string
): AgentSessionDeclaredAccess | undefined {
  return agentSessionDeclaredAccess(
    structuredAgentRuntimeRegistration(agent)?.definition.capabilities
  )
}

/**
 * `undefined` keeps the chat's own default, as a chat the user opens does. An explicit mode resolves
 * to itself when the agent declares it, else to the safest declared mode no more permissive than it.
 */
export function resolveWorkerStartAccessMode(args: {
  agent: string
  requested: AgentSessionAccessModeValue | undefined
  declared: AgentSessionDeclaredAccess | undefined
}): AgentSessionExplicitAccess | undefined {
  const { requested, declared } = args
  if (requested === undefined || requested === 'inherit') {
    return undefined
  }
  const supported = declared?.explicit ?? []
  if (supported.includes(requested)) {
    return requested
  }
  const ceiling = PERMISSIVENESS[requested]
  const safest = supported
    .filter((mode) => PERMISSIVENESS[mode] <= ceiling)
    .sort((left, right) => PERMISSIVENESS[left] - PERMISSIVENESS[right])[0]
  if (safest === undefined) {
    throw new OrchestrationError(
      'capability_unsupported',
      `${args.agent} cannot run a worker in ${requested} access and declares no narrower mode. No effects were applied.`,
      { effectsApplied: false }
    )
  }
  return safest
}

/** The access one start runs in, and the form of it the host judges when it answers for the mode. */
export type WorkerStartAccess = {
  accessMode: AgentSessionExplicitAccess | undefined
  hostAccessMode: 'default' | 'full-access' | undefined
}

/** The access a start asks for, refusing any combination no structured worker could honour. */
export function resolveWorkerStartAccess(
  agent: TuiAgent | undefined,
  requested: AgentSessionAccessModeValue | undefined,
  terminal: string | undefined
): WorkerStartAccess {
  assertWorkerStartAccessModeApplies({ requested, terminal })
  const accessMode = agent
    ? resolveWorkerStartAccessMode({
        agent,
        requested,
        declared: declaredAccessForStructuredAgent(agent)
      })
    : undefined
  const hostAccessMode =
    accessMode === 'default' || accessMode === 'full-access' ? accessMode : undefined
  return { accessMode, hostAccessMode }
}

/** An explicit access must end as a structured worker, since a terminal would run without it. */
export function assertStructuredForAccess(
  access: WorkerStartAccess,
  mode: WorkerStartModeReceipt,
  effectsApplied: boolean
): void {
  if (access.accessMode === undefined || mode.mode === 'structured') {
    return
  }
  throw new OrchestrationError(
    'capability_unsupported',
    `--access-mode needs a structured chat worker, but this start would run a terminal: ${mode.detail}`,
    { effectsApplied }
  )
}
