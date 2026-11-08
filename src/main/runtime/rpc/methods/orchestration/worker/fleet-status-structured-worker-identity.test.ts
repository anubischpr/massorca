import { afterEach, describe, expect, it } from 'vitest'
import type { OrcaRuntimeService } from '../../../../orca-runtime'
import type { OrchestrationDb } from '../../../../orchestration/db'
import { OrcaRuntimeWithGetOrchestrationDispatchAuthority } from '../../../../orca-runtime-get-orchestration-dispatch-authority'
import { toAgentStatusIpcPayload } from '../../../../../agent-hooks/server/server-status-identity'
import type { EnrichedAgentHookEventPayload } from '../../../../../agent-hooks/server/server-types'
import { structuredRowPaneKey } from '../../../../structured-session-lineage'
import {
  structuredWorkerIdentities,
  structuredWorkerProcessIncarnation
} from '../../../../structured-worker-identity'
import { projectFleetWorkerPage } from './worker-observation'

const SESSION_ID = 'session-child'
const HANDLE = 'structworker_6d134b48-6f4e-435a-b34e-3fa498b246eb'
/** The random pane key minted for the worker, not the session's derived status row key. */
const WORKER_PANE_KEY =
  'structured-agent-session-session-child:3f1d4a52-1b6e-4c8e-9a4f-6a5e2c1d9b70'
const DISPATCH_ID = 'ctx_structured'
const observedAt = (): number => Date.now() - 1_000

function structuredRowAsPublished(sessionId = SESSION_ID) {
  const paneKey = structuredRowPaneKey(sessionId)
  return toAgentStatusIpcPayload({
    paneKey,
    tabId: paneKey.slice(0, paneKey.indexOf(':')),
    worktreeId: 'wt-child',
    connectionId: null,
    receivedAt: observedAt(),
    stateStartedAt: observedAt(),
    payload: { state: 'working', agentType: 'antigravity' }
  } as unknown as EnrichedAgentHookEventPayload)
}

function createDb(): OrchestrationDb {
  return {
    listWorkerTerminalResources: () => [
      {
        dispatchId: DISPATCH_ID,
        taskId: 'task-structured',
        runId: 'run-structured',
        parentTaskId: null,
        workerState: 'ready',
        dispatchStatus: 'dispatched',
        workerStage: 'input_accepted',
        agentTerminalHandle: HANDLE,
        paneKey: WORKER_PANE_KEY,
        worktreeId: 'wt-child',
        terminalState: 'active',
        pendingInput: false,
        pendingApproval: false,
        terminationReason: null,
        resource: {
          id: 'res-structured',
          owner_dispatch_id: DISPATCH_ID,
          worktree_id: 'wt-child',
          pane_key: WORKER_PANE_KEY,
          process_incarnation: structuredWorkerProcessIncarnation(SESSION_ID),
          endpoint_id: null,
          endpoint_incarnation: structuredWorkerProcessIncarnation(SESSION_ID),
          host_scope: JSON.stringify({ kind: 'local', hostId: 'local' }),
          ownership_state: 'owned',
          release_state: 'none',
          updated_at: new Date().toISOString()
        },
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        databaseId: 1
      }
    ],
    getWorkerAttentionFactsForDispatches: () => new Map()
  } as unknown as OrchestrationDb
}

function createRuntime(rowSessionId?: string): OrcaRuntimeService {
  const db = createDb()
  const host = {
    getAgentStatusSnapshotFn: () => [structuredRowAsPublished(rowSessionId)],
    // A structured session has no PTY, so the terminal registry resolves nothing for its row.
    getAgentStatusTerminalHandleForPaneKey: () => undefined,
    getAgentStatusOrchestrationContextForPaneKey: () => undefined,
    getTerminalProcessIncarnation: () => null,
    readObservedAgentStatusPaneIdentityFn: () => ({ kind: 'unobserved' }) as const,
    getOrchestrationDbIfAvailable: () => db
  }
  return {
    getOrchestrationFleetAgentStatusSnapshot: () =>
      OrcaRuntimeWithGetOrchestrationDispatchAuthority.prototype.getOrchestrationFleetAgentStatusSnapshot.call(
        host as never
      )
  } as unknown as OrcaRuntimeService
}

function registerWorker(): void {
  structuredWorkerIdentities.register({
    handle: HANDLE,
    sessionId: SESSION_ID,
    agent: 'antigravity',
    paneKey: WORKER_PANE_KEY,
    processIncarnation: structuredWorkerProcessIncarnation(SESSION_ID),
    worktreeId: 'wt-child',
    hostScope: { kind: 'local', hostId: 'local' }
  } as never)
}

describe('fleet liveness of a structured chat worker', () => {
  afterEach(() => {
    structuredWorkerIdentities.clear()
  })

  it('reads live from the status row its session publishes', () => {
    registerWorker()
    const page = projectFleetWorkerPage(createRuntime(), createDb(), DISPATCH_ID)

    expect(page?.workers[0]).toMatchObject({
      liveness: { verdict: 'live', source: 'agent_status' },
      evidence: { liveStatus: 'fresh' }
    })
  })

  it('stays unverifiable when the row belongs to a session no worker runs', () => {
    registerWorker()
    const page = projectFleetWorkerPage(createRuntime('session-other'), createDb(), DISPATCH_ID)

    expect(page?.workers[0]?.liveness).toMatchObject({
      verdict: 'unverifiable',
      reason: 'missing_status'
    })
  })
})
