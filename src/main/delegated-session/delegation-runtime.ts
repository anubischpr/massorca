import { hasAppEnvironment } from '../../shared/app-environment'
import type { StructuredAgentId } from '../../shared/agent-session-provider-handle'
import type { RateLimitState } from '../../shared/rate-limit-types'
import { GENTLE_SHELL_LABEL } from '../../shared/agent-type-label'
import { isTuiAgent } from '../../shared/tui-agent-config'
import { TUI_AGENT_DISPLAY_NAMES } from '../../shared/tui-agent-display-names'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import type { StructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-host'
import { structuredAgentSessionHostRows } from '../native-chat/agent-session-wire/structured-agent-session-host-rows'
import { lastPersonMessageText } from './delegation-person-message'
import { launchDirectoryOfChat } from '../native-chat/chat-launch-directory'
import { readDesignSystemOfLaunchDirectory } from '../native-chat/prototype-design-system-files'
import {
  prototypeSystemCardOf,
  type PrototypeSystemCard
} from '../../shared/prototype-design-system-card'
import { observeDispatchSettlements } from '../runtime/orchestration/db/dispatch-settlement-observers'
import type { OrchestrationDb } from '../runtime/orchestration/db'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { STRUCTURED_AGENT_RUNTIME_REGISTRATIONS } from '../runtime/structured-agent-runtime-registrations'
import { declaredAccessForStructuredAgent } from '../runtime/rpc/methods/orchestration/worker/worker-start-access-mode'
import type { ChildBringBackPolicy } from '../../shared/child-bring-back'
import { launchedAccessPosture } from '../native-chat/agent-session-wire/structured-agent-session-access-posture'
import { ChildBringBackService } from './child-bring-back'
import { ChildBringBackAutomatic, childBringBackPolicyOf } from './child-bring-back-automatic'
import { storedOptionsWithAutomaticBringBack } from './delegation-stored-request'
import { readJevApiKey } from '../jev/jev-api-key-store'
import { DelegationAnswerService } from './delegation-answer-service'
import { createJevDelegationTierAdvisor } from './delegation-jev-tier'
import { createDelegationLauncher } from './delegation-launch'
import { discardFailedDelegatedStart } from './delegation-failed-start'
import type { DelegationStoredAgent } from './delegation-options'
import { DelegationRequestService } from './delegation-request-service'
import { delegatedChildFirstPrompt } from './delegated-child-first-prompt'
import { delegatedChildPromptDeps } from './delegated-child-prompt-deps'
import type { DelegationParentSession, DelegationRequestDeps } from './delegation-service-types'
import { sendAgentTurn } from '../runtime/orchestration/send-agent-turn'
import { structuredSessionPointerCallerKey } from '../runtime/orchestration/structured-mailbox-pointer-host'
import { mintAgentSessionOperationId } from '../runtime/orchestration/structured-pointer-operation-id'

/** The runtime surface delegation reads; everything else goes through the host registry. */
type DelegationRuntime = Pick<
  OrcaRuntimeService,
  | 'getOrchestrationDb'
  | 'getExistingOrchestrationDb'
  | 'getAccountsSnapshot'
  | 'refreshAccountsForMobileSubscriber'
  | 'isJevDecisionsEnabled'
  | 'getStructuredAgentSessionCreateSupport'
  | 'resolveStructuredAgentSessionLocalWorkspacePath'
>

const requestServices = new WeakMap<object, DelegationRequestService>()
const answerServices = new WeakMap<object, DelegationAnswerService>()
const bringBackServices = new WeakMap<object, ChildBringBackService>()
const bringBackAutomatics = new WeakMap<object, ChildBringBackAutomatic>()
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

/** The person's last message in the parent chat, read from its journal on this host. */
async function readParentUserMessage(sessionId: string): Promise<string | undefined> {
  const host = getStructuredAgentSessionHost()
  if (!host?.deps.store.getRecord(sessionId)) {
    return undefined
  }
  const { journal } = await host.lifetime.conversation(sessionId)
  return lastPersonMessageText(journal.snapshot().items)
}

/** The design system card of the parent chat's project, read on this host like the composer's request does. */
async function readParentDesignSystemCard(sessionId: string): Promise<PrototypeSystemCard | null> {
  const host = getStructuredAgentSessionHost()
  const record = host?.deps.store.getRecord(sessionId)
  if (!host || !record) {
    return null
  }
  const launchDirectory = await launchDirectoryOfChat(record, host.deps.resolveWorkspacePath)
  if (launchDirectory === undefined) {
    return null
  }
  const read = await readDesignSystemOfLaunchDirectory(launchDirectory)
  return read.ok ? prototypeSystemCardOf(read) : null
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
      } catch (error) {
        // A check that throws leaves the agent out, and the reason is logged rather than lost.
        console.warn(`[delegated-session] checking ${agent} for a child session failed`, error)
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

function tellParentAgent(parentSessionId: string, text: string): void {
  const host = getStructuredAgentSessionHost()
  const fence = host?.deps.store.getRecord(parentSessionId)?.lease.runtimeFence
  if (!host || fence === undefined) {
    return
  }
  void sendAgentTurn({
    kind: 'structured-session',
    host,
    sessionId: parentSessionId,
    callerKey: structuredSessionPointerCallerKey(parentSessionId),
    turn: {
      body: {
        kind: 'message',
        role: 'user',
        blocks: [{ type: 'text', text }],
        from: { kind: 'agent', senders: [], orchestration: null }
      },
      // As a person's message is: a busy chat queues it, an idle one starts a turn on it.
      delivery: 'queue',
      operationId: mintAgentSessionOperationId(Date.now()),
      expectedRuntimeFence: fence
    }
  }).catch((error: unknown) => {
    console.warn('[delegation] telling the parent agent failed', parentSessionId, error)
  })
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
    readPrototypeCount: () => runtime.readPrototypeCountSetting(),
    readDesignSystemCard: readParentDesignSystemCard,
    readParentUserMessage,
    readRateLimits: () => readRateLimits(runtime),
    refreshUsage: () => runtime.refreshAccountsForMobileSubscriber(),
    now: () => Date.now(),
    isBotRunSession: (sessionId) =>
      existingDb(runtime)?.findBotTeamTaskBySession(sessionId) != null,
    startAutomatic: (requestId) => getDelegationAnswerService(runtime).startAutomatic(requestId),
    // Why here: the host holding the chat decides, with its own setting and key.
    adviseTier: createJevDelegationTierAdvisor({
      isEnabled: () => runtime.isJevDecisionsEnabled(),
      readApiKey: readJevApiKey
    })
  })
  requestServices.set(runtime, service)
  return service
}

function readSessionWorkspaceId(sessionId: string): string | null {
  return (
    getStructuredAgentSessionHost()?.deps.store.getRecord(sessionId)?.location.workspaceId ?? null
  )
}

async function isSessionWorking(sessionId: string): Promise<boolean> {
  const host = getStructuredAgentSessionHost()
  if (!host?.deps.store.getRecord(sessionId)) {
    return false
  }
  const { journal } = await host.lifetime.conversation(sessionId)
  return journal.activeTurnId() !== null
}

/** The runtime's Bring back service: git runs wherever each worktree's host is. */
export function getChildBringBackService(runtime: OrcaRuntimeService): ChildBringBackService {
  const existing = bringBackServices.get(runtime)
  if (existing) {
    return existing
  }
  const service = new ChildBringBackService({
    readRequest: (requestId) => existingDb(runtime)?.getDelegationRequest(requestId),
    readWorkspaceId: readSessionWorkspaceId,
    isSessionWorking,
    gitIn: (workspaceId) => runtime.openRuntimeGitWorktree(`id:${workspaceId}`),
    tellParent: tellParentAgent,
    warn: (message, error) => console.warn(`[delegated-session] ${message}`, error)
  })
  bringBackServices.set(runtime, service)
  return service
}

function readBringBackPolicy(parentSessionId: string): ChildBringBackPolicy {
  const host = getStructuredAgentSessionHost()
  return childBringBackPolicyOf(
    host ? launchedAccessPosture(host.deps, parentSessionId) : undefined
  )
}

function getChildBringBackAutomatic(runtime: OrcaRuntimeService): ChildBringBackAutomatic {
  const existing = bringBackAutomatics.get(runtime)
  if (existing) {
    return existing
  }
  const automatic = new ChildBringBackAutomatic({
    service: getChildBringBackService(runtime),
    readRequest: (requestId) => existingDb(runtime)?.getDelegationRequest(requestId),
    listFinishedRequests: () =>
      existingDb(runtime)?.listDelegationRequestsByStatus('finished') ?? [],
    readWorkspaceId: readSessionWorkspaceId,
    readPolicy: readBringBackPolicy,
    mark: (requestId, mark) => {
      const db = existingDb(runtime)
      const row = db?.getDelegationRequest(requestId)
      if (db && row) {
        db.patchDelegationRequest(requestId, {
          options_json: storedOptionsWithAutomaticBringBack(row, mark)
        })
      }
    },
    tellParent: tellParentAgent,
    warn: (message, error) => console.warn(`[delegated-session] ${message}`, error)
  })
  bringBackAutomatics.set(runtime, automatic)
  return automatic
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
    refreshUsage: () => runtime.refreshAccountsForMobileSubscriber(),
    tellParent: tellParentAgent,
    onChildSucceeded: (requestId) =>
      void getChildBringBackAutomatic(runtime).onChildFinished(requestId),
    launch: createDelegationLauncher({
      requireDb: () => runtime.getOrchestrationDb(),
      declaredAccess: declaredAccessForStructuredAgent,
      folderPath: (workspaceId) =>
        runtime.resolveStructuredAgentSessionLocalWorkspacePath(`id:${workspaceId}`),
      discardFailedStart: (failed) =>
        discardFailedDelegatedStart(
          {
            releaseDispatch: async (dispatchId) => {
              // Loaded on use, like the worker-start pipeline below.
              const { releaseLocalWorkerDispatch } =
                await import('../runtime/rpc/methods/orchestration/worker/worker-release')
              return releaseLocalWorkerDispatch({
                runtime,
                db: runtime.getOrchestrationDb(),
                dispatchId
              })
            },
            // Forced: this start created the worktree and no agent ever ran in it.
            removeWorktree: (worktreeId) =>
              runtime.removeManagedWorktree(`id:${worktreeId}`, {
                force: true,
                waitForBackgroundRemoval: true
              }),
            warn: (message, error) => console.warn(`[delegated-session] ${message}`, error)
          },
          failed
        ),
      readChildGit: async (childSessionId) => {
        const workspaceId = readSessionWorkspaceId(childSessionId)
        const git = workspaceId && (await runtime.openRuntimeGitWorktree(`id:${workspaceId}`))
        if (!git) {
          return null
        }
        const [branch, baseSha] = await Promise.all([
          git.run(['symbolic-ref', '--short', '-q', 'HEAD']),
          git.run(['rev-parse', 'HEAD'])
        ])
        return { branch: branch.trim(), baseSha: baseSha.trim() }
      },
      warn: (message, error) => console.warn(`[delegated-session] ${message}`, error),
      startWorker: async ({
        params,
        run,
        caller,
        task,
        prototypeCount,
        designSystem,
        prototypeTask
      }) => {
        // Loaded on use: the worker-start pipeline imports far more than a request needs.
        const [{ startLocalWorker }, modeModule, timing] = await Promise.all([
          import('../runtime/rpc/methods/orchestration/worker/local-worker-start'),
          import('../runtime/rpc/methods/orchestration-worker-start-mode'),
          import('../../shared/orchestration-timing-budgets')
        ])
        return startLocalWorker({
          params: {
            ...params,
            timeoutMs: timing.resolveWorkerStartReadinessTimeoutMs(undefined)
          },
          runtime,
          db: runtime.getOrchestrationDb(),
          run,
          coordinator: caller,
          callerSession: caller,
          existingTask: task,
          firstPrompt: (childSessionId) =>
            delegatedChildFirstPrompt(
              {
                childSessionId,
                originSessionId: caller.sessionId,
                taskSpec: task.spec,
                ...(prototypeCount === undefined ? {} : { count: prototypeCount }),
                ...(designSystem === undefined ? {} : { designSystem }),
                ...(prototypeTask ? { prototypeTask } : {})
              },
              delegatedChildPromptDeps(runtime)
            ),
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
  // Held weakly, so the listener never keeps a runtime alive; it unsubscribes once the runtime is gone.
  const owner = new WeakRef(runtime)
  const stopListening = observeDispatchSettlements((rawDb, dispatchId) => {
    const current = owner.deref()
    if (!current) {
      stopListening()
      return
    }
    if (existingDb(current)?.db === rawDb) {
      void answerServices.get(current)?.onDispatchSettled(dispatchId)
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
  const automatic = getChildBringBackAutomatic(runtime)
  void automatic.reconcile()
  getStructuredAgentSessionHost()?.subscribeTurnCompletions({
    id: 'child-bring-back-automatic',
    emit: (event) => {
      if (event.type === 'completion') {
        void automatic.onTurnEnded(event.completion.sessionId)
      }
    }
  })
}
