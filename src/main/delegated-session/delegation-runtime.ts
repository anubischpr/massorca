import { hasAppEnvironment } from '../../shared/app-environment'
import type { StructuredAgentId } from '../../shared/agent-session-provider-handle'
import type { RateLimitState } from '../../shared/rate-limit-types'
import { GENTLE_SHELL_LABEL } from '../../shared/agent-type-label'
import { isTuiAgent } from '../../shared/tui-agent-config'
import { TUI_AGENT_DISPLAY_NAMES } from '../../shared/tui-agent-display-names'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import type { StructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-host'
import { structuredAgentSessionHostRows } from '../native-chat/agent-session-wire/structured-agent-session-host-rows'
import { observeDispatchSettlements } from '../runtime/orchestration/db/dispatch-settlement-observers'
import type { OrchestrationDb } from '../runtime/orchestration/db'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { STRUCTURED_AGENT_RUNTIME_REGISTRATIONS } from '../runtime/structured-agent-runtime-registrations'
import { declaredAccessForStructuredAgent } from '../runtime/rpc/methods/orchestration/worker/worker-start-access-mode'
import { DelegationAnswerService } from './delegation-answer-service'
import { createDelegationLauncher } from './delegation-launch'
import type { DelegationStoredAgent } from './delegation-options'
import { DelegationRequestService } from './delegation-request-service'
import type { DelegationParentSession, DelegationRequestDeps } from './delegation-service-types'

/** The runtime surface delegation reads; everything else goes through the host registry. */
type DelegationRuntime = Pick<
  OrcaRuntimeService,
  | 'getOrchestrationDb'
  | 'getExistingOrchestrationDb'
  | 'getAccountsSnapshot'
  | 'getStructuredAgentSessionCreateSupport'
>

const requestServices = new WeakMap<object, DelegationRequestService>()
const answerServices = new WeakMap<object, DelegationAnswerService>()
const reconciled = new WeakSet<object>()

function requireHost(): StructuredAgentSessionHost {
  const host = getStructuredAgentSessionHost()
  if (!host) {
    throw new Error('The chat host is not running on this runtime.')
  }
  return host
}

function readParentSession(sessionId: string): DelegationParentSession | null {
  const record = getStructuredAgentSessionHost()?.deps.store.getRecord(sessionId)
  if (!record) {
    return null
  }
  return {
    sessionId: record.sessionId,
    agent: record.provider,
    workspaceId: record.location.workspaceId,
    workspaceKind: record.location.workspaceKind === 'folder' ? 'folder' : 'git',
    accessMode: record.options?.accessMode
  }
}

function agentLabel(agent: string, piRuntime: string | undefined): string {
  if (agent === 'pi' && piRuntime === 'gentle-shell') {
    return GENTLE_SHELL_LABEL
  }
  return isTuiAgent(agent) ? TUI_AGENT_DISPLAY_NAMES[agent] : agent
}

/** Every agent this host registers that can start a chat in the parent's workspace right now. */
async function listUsableAgents(
  runtime: DelegationRuntime,
  parent: DelegationParentSession
): Promise<DelegationStoredAgent[]> {
  const selector = `id:${parent.workspaceId}`
  const found = await Promise.all(
    STRUCTURED_AGENT_RUNTIME_REGISTRATIONS.map(async ({ definition }) => {
      const agent: StructuredAgentId = definition.agent
      try {
        const support = await runtime.getStructuredAgentSessionCreateSupport(selector, agent)
        return support.supported
          ? [
              {
                agent,
                label: agentLabel(agent, support.piRuntime),
                ...(support.piRuntime ? { piRuntime: support.piRuntime } : {})
              }
            ]
          : []
      } catch {
        // An agent whose check throws is not one a child can be promised.
        return []
      }
    })
  )
  return found.flat()
}

function existingDb(runtime: DelegationRuntime): OrchestrationDb | null {
  try {
    return runtime.getExistingOrchestrationDb()
  } catch (error) {
    // A profile whose database cannot be opened has no request this service could answer. Before
    // the app environment exists there is no profile to open, which is not worth a warning.
    if (hasAppEnvironment()) {
      console.warn('[delegated-session] the orchestration database could not be opened', error)
    }
    return null
  }
}

function readRateLimits(runtime: DelegationRuntime): RateLimitState | null {
  try {
    return runtime.getAccountsSnapshot().rateLimits
  } catch {
    // Accounts services start with the app; before them every agent reads as having no data.
    return null
  }
}

function hostRows(): DelegationRequestDeps['rows'] {
  return {
    appendHostRow: (sessionId, identity, body) =>
      structuredAgentSessionHostRows(requireHost()).appendHostRow(sessionId, identity, body)
  }
}

/** The runtime's delegation request service. */
export function getDelegationRequestService(runtime: OrcaRuntimeService): DelegationRequestService {
  const existing = requestServices.get(runtime)
  if (existing) {
    return existing
  }
  const service = new DelegationRequestService({
    getDb: () => existingDb(runtime),
    requireDb: () => runtime.getOrchestrationDb(),
    rows: hostRows(),
    readParent: readParentSession,
    listAgents: (parent) => listUsableAgents(runtime, parent),
    readRateLimits: () => readRateLimits(runtime),
    now: () => Date.now()
  })
  requestServices.set(runtime, service)
  return service
}

/** The runtime's delegation answer service; its dispatch listener lives as long as the process. */
export function getDelegationAnswerService(runtime: OrcaRuntimeService): DelegationAnswerService {
  const existing = answerServices.get(runtime)
  if (existing) {
    return existing
  }
  const service = new DelegationAnswerService({
    getDb: () => existingDb(runtime),
    rows: hostRows(),
    readParent: readParentSession,
    readRateLimits: () => readRateLimits(runtime),
    launch: createDelegationLauncher({
      requireDb: () => runtime.getOrchestrationDb(),
      declaredAccess: declaredAccessForStructuredAgent,
      startWorker: async ({ params, run, caller, task }) => {
        // Loaded on use: the worker-start pipeline imports far more than a request needs.
        const [{ startLocalWorker }, modeModule, timing] = await Promise.all([
          import('../runtime/rpc/methods/orchestration/worker/local-worker-start'),
          import('../runtime/rpc/methods/orchestration-worker-start-mode'),
          import('../../shared/orchestration-timing-budgets')
        ])
        return startLocalWorker({
          params: { ...params, timeoutMs: timing.resolveWorkerStartReadinessTimeoutMs(undefined) },
          runtime,
          db: runtime.getOrchestrationDb(),
          run,
          coordinator: caller,
          callerSession: caller,
          existingTask: task,
          mode: modeModule.decideWorkerStartMode({
            params,
            settings: modeModule.readWorkerStartModeSettings(runtime)
          })
        })
      }
    }),
    now: () => Date.now(),
    warn: (message, error) => console.warn(`[delegated-session] ${message}`, error)
  })
  answerServices.set(runtime, service)
  observeDispatchSettlements((rawDb, dispatchId) => {
    if (existingDb(runtime)?.db === rawDb) {
      void service.onDispatchSettled(dispatchId)
    }
  })
  return service
}

/** Once the chat host is up: finishes what a restart left half done. Later calls do nothing. */
export function reconcileDelegationRequests(runtime: OrcaRuntimeService): void {
  if (reconciled.has(runtime)) {
    return
  }
  reconciled.add(runtime)
  getDelegationAnswerService(runtime)
    .reconcile()
    .catch((error: unknown) => {
      console.warn('[delegated-session] reconciling delegation requests failed', error)
    })
}
