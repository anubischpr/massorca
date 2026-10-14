import type { TuiAgent } from '../../../shared/tui-agent'
import { isDefinitiveAgentSessionCreateRefusal } from '../../../shared/agent-session-definitive-refusal'
import { parseStructuredLaunchSeedOptions } from '../../../shared/native-chat-session-option-defaults'
import { hasRuntimeRpcErrorCode } from '../../../shared/runtime-rpc-error-code'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import { callStructuredAgentSession } from '@/runtime/structured-agent-session-client'
import { selectedPiRuntime, type PiRuntimeSelection } from '../../../shared/pi-runtime-selection'
import { useAppStore } from '@/store'
import type { StructuredAgentSessionCreateParams } from '../../../shared/structured-agent-session-create'
import { readAgentSessionErrorRefusal } from '../../../shared/agent-session-write-failure'
import {
  StructuredAgentSessionCreateRefusalError,
  StructuredAgentSessionCreateUnknownOutcomeError
} from './structured-agent-session-launch-errors'

/** The host answers a worktree selector it cannot resolve yet with this rather than a verdict. */
const SELECTOR_NOT_RESOLVABLE_CODE = 'selector_not_found'

/**
 * A worktree is not resolvable for a beat after `createWorktree` resolves, so a probe fired
 * immediately after creation fails instead of answering. Measured window: under ~250ms. These
 * delays cover it with margin and bound the wait when the selector is genuinely absent.
 */
const CREATE_SUPPORT_RETRY_DELAYS_MS: readonly number[] = [50, 150, 300]

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function runtimeErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return 'runtime_unavailable'
}

/** The owning host's answer to "can you run this chat here?", asked before anything is created.
 *  An admitting host also names the saved selection create will seed, when it is new enough to. */
export type StructuredLaunchAdmission =
  | { kind: 'admitted'; seedOptions?: Readonly<Record<string, string>> }
  | { kind: 'declined' }
  | { kind: 'unreachable' }
  /** The host still could not resolve the workspace after the retries: not yet, rather than no. */
  | { kind: 'workspace-unresolved' }

export type HostCreateSupport =
  | Exclude<StructuredLaunchAdmission, { kind: 'unreachable' }>
  | { kind: 'policy-unsupported'; seedOptions?: Readonly<Record<string, string>> }
  | { kind: 'unreachable'; code: string; message: string; error: unknown }

/**
 * Whether the executing host supports creating this session, retrying only while the host cannot
 * yet resolve the worktree. "Could not answer" and "answered no" are different states and only the
 * second is a verdict. A paired server's call is bounded by the runtime RPC client's timeout; this
 * machine's call has none.
 */
export async function askHostCreateSupport(
  target: RuntimeClientTarget,
  worktree: string,
  agent: TuiAgent,
  piRuntime?: PiRuntimeSelection,
  accessMode?: 'default' | 'full-access'
): Promise<HostCreateSupport> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const support = await callStructuredAgentSession<{
        supported: boolean
        reason?: string
        seedOptions?: unknown
      }>(target, 'agentSession.createSupport', {
        worktree,
        agent,
        ...(piRuntime === 'gentle-shell' ? { piRuntime } : {}),
        ...(accessMode ? { accessMode } : {})
      })
      if (support.supported !== true) {
        if (support.reason === 'access') {
          return {
            kind: 'policy-unsupported',
            seedOptions: parseStructuredLaunchSeedOptions(support.seedOptions)
          }
        }
        return piRuntime === 'gentle-shell'
          ? {
              kind: 'unreachable',
              code: 'pi_runtime_unsupported',
              message: 'This host cannot run the selected Gentle Shell runtime in chat.',
              error: new Error('Gentle Shell structured runtime unavailable')
            }
          : { kind: 'declined' }
      }
      const seedOptions = parseStructuredLaunchSeedOptions(support.seedOptions)
      const retainedSeed =
        agent === 'pi' ? { ...seedOptions, piRuntime: piRuntime ?? 'pi' } : seedOptions
      return retainedSeed ? { kind: 'admitted', seedOptions: retainedSeed } : { kind: 'admitted' }
    } catch (error) {
      if (hasRuntimeRpcErrorCode(error, SELECTOR_NOT_RESOLVABLE_CODE)) {
        const retryDelayMs = CREATE_SUPPORT_RETRY_DELAYS_MS[attempt]
        if (retryDelayMs === undefined) {
          return { kind: 'workspace-unresolved' }
        }
        await delay(retryDelayMs)
        continue
      }
      const code = runtimeErrorCode(error)
      if (isDefinitiveAgentSessionCreateRefusal(code)) {
        return { kind: 'declined' }
      }
      const message = error instanceof Error ? error.message : String(error)
      return { kind: 'unreachable', code, message, error }
    }
  }
}

/** How long a launch on this machine waits for its answer before anything shows. Past it the
 *  launch treats the host as unable to answer, and the chat's own create keeps asking. */
export const LOCAL_ADMISSION_WAIT_MS = 3_000

/** Refuses a create before reservation; policy refusal keeps its provisional picker editable. */
export async function requireStructuredAgentLaunchSupport(
  intent: {
    target: RuntimeClientTarget
    agent: TuiAgent
    params: StructuredAgentSessionCreateParams
  },
  abandon: () => void
): Promise<Readonly<Record<string, string>> | undefined> {
  const support = await askHostCreateSupport(
    intent.target,
    intent.params.worktree,
    intent.agent,
    intent.params.piRuntime,
    intent.params.accessMode
  )
  if (support.kind === 'policy-unsupported') {
    const error = new StructuredAgentSessionCreateRefusalError(
      'Pi chat does not support restricted access. Choose Full access explicitly, or use the terminal.',
      'structured_agent_session_unsupported',
      { code: 'structured_agent_session_unsupported', details: { reason: 'hostUnsupported' } }
    )
    error.accessPolicyUnsupported = true
    throw error
  }
  if (support.kind === 'unreachable') {
    throw new StructuredAgentSessionCreateUnknownOutcomeError(
      support.message,
      support.code,
      readAgentSessionErrorRefusal(support.error)
    )
  }
  if (support.kind === 'declined' || support.kind === 'workspace-unresolved') {
    abandon()
    throw new StructuredAgentSessionCreateRefusalError(
      'structured_agent_session_unsupported',
      'structured_agent_session_unsupported'
    )
  }
  return support.seedOptions
}

/** Asks a host to admit a chat before the client commits any of it. */
export async function admitStructuredLaunchOnHost(
  target: RuntimeClientTarget,
  worktree: string,
  agent: TuiAgent
): Promise<StructuredLaunchAdmission> {
  const piRuntime =
    agent === 'pi'
      ? selectedPiRuntime(useAppStore.getState().settings?.agentCmdOverrides?.pi)
      : undefined
  const asked = askHostCreateSupport(target, worktree, agent, piRuntime).then(
    (support): StructuredLaunchAdmission =>
      support.kind === 'unreachable'
        ? { kind: 'unreachable' }
        : support.kind === 'policy-unsupported'
          ? {
              kind: 'admitted',
              seedOptions: { ...support.seedOptions, piRuntime: piRuntime ?? 'pi' }
            }
          : support
  )
  if (target.kind !== 'local') {
    return asked
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<StructuredLaunchAdmission>((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'unreachable' }), LOCAL_ADMISSION_WAIT_MS)
  })
  try {
    return await Promise.race([asked, timedOut])
  } finally {
    clearTimeout(timer)
  }
}
