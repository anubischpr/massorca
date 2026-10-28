import type { StructuredAgentId } from '../../../src/shared/agent-session-provider-handle'
import type {
  AgentSessionAttachResult,
  AgentSessionMutationResult
} from '../../../src/shared/agent-session-wire'
import { isDefinitiveAgentSessionCreateRefusal } from '../../../src/shared/agent-session-definitive-refusal'
import {
  createStructuredAgentSessionId,
  structuredAgentSessionCreateParams,
  type StructuredAgentSessionCreateParams
} from '../../../src/shared/structured-agent-session-create'
import { formatAgentTypeLabel } from '../../../src/shared/agent-type-label'
import {
  isPiRuntimeSelection,
  type PiRuntimeSelection
} from '../../../src/shared/pi-runtime-selection'
import { hasRuntimeRpcErrorCode } from '../../../src/shared/runtime-rpc-error-code'
import type { RpcClient } from '../transport/rpc-client'
import {
  structuredAgentSessionCreate,
  structuredAgentSupportProbe
} from './mobile-session-launch-operations'
import { structuredSessionRandomUuid } from './structured-session-operation-id'
import { rememberMobileCreatedStructuredSession } from './mobile-created-structured-sessions'
import { rememberMobileStructuredPiRuntime } from './mobile-structured-pi-runtime-record'

type StructuredCreateSupport = {
  supported?: boolean
  reason?: 'agent' | 'remote' | 'wsl' | 'access'
  /** The Pi runtime a probe that named none fell back to; the create must run that same runtime. */
  piRuntime?: unknown
  seedOptions?: { piRuntime?: unknown }
}

const SELECTOR_NOT_RESOLVABLE_CODE = 'selector_not_found'
const CREATE_SUPPORT_RETRY_DELAYS_MS: readonly number[] = [50, 150, 300]

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type MobileStructuredAgentLaunchResult =
  | { kind: 'created'; sessionId: string }
  | { kind: 'unsupported'; reason?: StructuredCreateSupport['reason'] }
  | { kind: 'failed'; message: string }
  | { kind: 'unknown'; message: string }

/** The outcomes of a start that did not create a chat. */
type MobileStructuredFailure = Exclude<MobileStructuredAgentLaunchResult, { kind: 'created' }>

/** A created chat with the runtime fence its first send is checked against; null when the host omits it. */
export type MobileStructuredChatStart =
  | { kind: 'created'; sessionId: string; fence: number | null }
  | MobileStructuredFailure

/** What a create may name beyond its agent: the Pi runtime to start, and the Pi access mode. */
export type MobileStructuredCreateOptions = {
  piRuntime?: PiRuntimeSelection
  accessMode?: 'default' | 'full-access'
}

function createParamsFor(
  agent: StructuredAgentId,
  worktree: string,
  piRuntime: PiRuntimeSelection | undefined,
  accessMode: MobileStructuredCreateOptions['accessMode']
): StructuredAgentSessionCreateParams {
  return structuredAgentSessionCreateParams({
    sessionId: createStructuredAgentSessionId(agent, structuredSessionRandomUuid),
    worktree,
    agent,
    ...(piRuntime ? { piRuntime } : {}),
    ...(accessMode ? { accessMode } : {}),
    randomUuid: structuredSessionRandomUuid
  })
}

/** The Pi runtime the host answered in its support reply, accepted only when it names a runtime. */
function hostAnsweredPiRuntime(support: StructuredCreateSupport): PiRuntimeSelection | undefined {
  const answered = support.piRuntime ?? support.seedOptions?.piRuntime
  return isPiRuntimeSelection(answered) ? answered : undefined
}

/** Whether a probe reply says the host can start the chat. A malformed reply says no. */
function probeSaysSupported(reply: unknown): boolean {
  if (typeof reply !== 'object' || reply === null || !('ok' in reply) || reply.ok !== true) {
    return false
  }
  if (!('result' in reply)) {
    return false
  }
  const { result } = reply
  return (
    typeof result === 'object' &&
    result !== null &&
    'supported' in result &&
    result.supported === true
  )
}

function unknownCreateResult(agent: StructuredAgentId, error: unknown): MobileStructuredFailure {
  const message = error instanceof Error ? error.message.trim() : ''
  return { kind: 'unknown', message: message || unconfirmedMessage(agent) }
}

function unconfirmedMessage(agent: StructuredAgentId): string {
  return `The ${formatAgentTypeLabel(agent)} chat result could not be confirmed.`
}

function failedMessage(agent: StructuredAgentId): string {
  return `Could not open ${formatAgentTypeLabel(agent)} chat.`
}

/** Only a refusal the host names as definitive may become `failed`; anything else keeps the
 *  outcome unknown so no legacy sibling terminal is created for a session that may exist. */
function classifyCreateRefusal(
  agent: StructuredAgentId,
  code: string,
  message: string
): MobileStructuredFailure {
  if (!isDefinitiveAgentSessionCreateRefusal(code)) {
    return unknownCreateResult(agent, new Error(message))
  }
  return { kind: 'failed', message: message || failedMessage(agent) }
}

/**
 * Whether the host can start this agent's chat in the worktree, asked before anything is created.
 * The Pi runtime is named so a Gentle Shell answer is never read from a stock Pi one.
 */
export async function canStartMobileStructuredAgentSession(
  client: RpcClient,
  worktreeId: string,
  agent: StructuredAgentId,
  options: MobileStructuredCreateOptions = {}
): Promise<boolean> {
  try {
    const reply = await structuredAgentSupportProbe.request(client, {
      worktree: `id:${worktreeId}`,
      agent,
      ...(options.piRuntime ? { piRuntime: options.piRuntime } : {})
    })
    return probeSaysSupported(reply)
  } catch {
    return false
  }
}

/** Creates the agent's chat in the worktree, naming the Pi runtime and access mode when given, and keeps the fence. */
export async function startMobileStructuredAgentSession(
  client: RpcClient,
  worktreeId: string,
  agent: StructuredAgentId,
  options: MobileStructuredCreateOptions = {}
): Promise<MobileStructuredChatStart> {
  const worktree = `id:${worktreeId}`
  let supportResponse
  for (let attempt = 0; ; attempt += 1) {
    try {
      supportResponse = await structuredAgentSupportProbe.request(client, {
        worktree,
        agent,
        ...(options.piRuntime ? { piRuntime: options.piRuntime } : {})
      })
    } catch (error) {
      const retryDelayMs = CREATE_SUPPORT_RETRY_DELAYS_MS[attempt]
      if (
        retryDelayMs === undefined ||
        !hasRuntimeRpcErrorCode(error, SELECTOR_NOT_RESOLVABLE_CODE)
      ) {
        return { kind: 'unsupported' }
      }
      await delay(retryDelayMs)
      continue
    }
    const retryDelayMs = CREATE_SUPPORT_RETRY_DELAYS_MS[attempt]
    if (
      retryDelayMs !== undefined &&
      hasRuntimeRpcErrorCode(supportResponse, SELECTOR_NOT_RESOLVABLE_CODE)
    ) {
      await delay(retryDelayMs)
      continue
    }
    break
  }
  if (
    !supportResponse ||
    typeof supportResponse !== 'object' ||
    typeof supportResponse.ok !== 'boolean' ||
    !supportResponse.ok
  ) {
    return { kind: 'unsupported' }
  }
  const support = supportResponse.result as StructuredCreateSupport | null
  if (!support || typeof support !== 'object' || support.supported !== true) {
    return { kind: 'unsupported', reason: support?.reason }
  }

  // Why: a Pi probe that named no runtime may have fallen back to Gentle Shell; the create must run that one.
  const params = createParamsFor(
    agent,
    worktree,
    agent === 'pi' ? (options.piRuntime ?? hostAnsweredPiRuntime(support)) : undefined,
    agent === 'pi' ? options.accessMode : undefined
  )
  rememberMobileCreatedStructuredSession(params.envelope.sessionId, worktree)
  let response
  try {
    response = await structuredAgentSessionCreate.request(client, params, {
      timeoutMs: 15_000,
      budgetSpansConnect: true
    })
  } catch {
    // Replay the durable envelope once so a lost acknowledgement cannot create a sibling.
    try {
      response = await structuredAgentSessionCreate.request(client, params, {
        timeoutMs: 15_000,
        budgetSpansConnect: true
      })
    } catch (retryError) {
      // A second transport error cannot disprove the first attempt committed.
      return unknownCreateResult(agent, retryError)
    }
  }

  // Why: this path distrusts the declared RpcResponse type — a malformed reply must read as
  // unconfirmed, not as a refusal we can classify.
  if (!response || typeof response !== 'object' || typeof response.ok !== 'boolean') {
    return unknownCreateResult(agent, new Error(unconfirmedMessage(agent)))
  }
  if (!response.ok) {
    const error = response.error as { code?: unknown; message?: unknown } | null | undefined
    if (
      !error ||
      typeof error !== 'object' ||
      typeof error.code !== 'string' ||
      typeof error.message !== 'string'
    ) {
      return unknownCreateResult(agent, new Error(unconfirmedMessage(agent)))
    }
    return classifyCreateRefusal(agent, error.code, error.message)
  }
  const result = response.result as AgentSessionMutationResult<AgentSessionAttachResult>
  if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean') {
    return unknownCreateResult(agent, new Error(unconfirmedMessage(agent)))
  }
  if (!result.ok) {
    if (
      !result.refusal ||
      typeof result.refusal !== 'object' ||
      typeof result.refusal.code !== 'string' ||
      typeof result.refusal.message !== 'string'
    ) {
      return unknownCreateResult(agent, new Error(unconfirmedMessage(agent)))
    }
    return classifyCreateRefusal(agent, result.refusal.code, result.refusal.message)
  }
  if (
    !result.value ||
    typeof result.value.sessionId !== 'string' ||
    !result.value.sessionId.trim()
  ) {
    return unknownCreateResult(agent, new Error(unconfirmedMessage(agent)))
  }
  rememberMobileStructuredPiRuntime(result.value.sessionId, params.piRuntime)
  return {
    kind: 'created',
    sessionId: result.value.sessionId,
    fence: typeof result.value.fence === 'number' ? result.value.fence : null
  }
}

/** The bare create the phone starts from an existing workspace: the same result shape it always had. */
export async function createMobileStructuredAgentSession(
  client: RpcClient,
  worktreeId: string,
  agent: StructuredAgentId
): Promise<MobileStructuredAgentLaunchResult> {
  const started = await startMobileStructuredAgentSession(client, worktreeId, agent)
  return started.kind === 'created' ? { kind: 'created', sessionId: started.sessionId } : started
}
