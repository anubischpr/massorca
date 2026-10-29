import { describe, expect, it, vi } from 'vitest'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../shared/structured-agent-session-projection'
import { RuntimeAgentOrchestrationProjection } from './runtime-agent-orchestration-projection'

const rowKey = (sessionId: string): string =>
  structuredAgentSessionPaneKey(structuredAgentSessionTabId(sessionId), sessionId)

const WORKER = {
  handle: 'structworker_1',
  paneKey: 'structured-agent-session-worker-session:4f9c1d2e-8a7b-4c6d-9e0f-1a2b3c4d5e6f',
  sessionId: 'worker-session'
}

type TestRun = {
  id: string
  legacy: number
  consumer_generation: number
  coordinator_handle: string | null
  coordinator_pane_key: string | null
  coordinator_orca_session_id: string | null
  coordinator_orca_session_id_generation: number | null
}

const COORDINATOR_RUN: TestRun = {
  id: 'run_1',
  legacy: 0,
  consumer_generation: 4,
  coordinator_handle: null,
  coordinator_pane_key: null,
  coordinator_orca_session_id: 'coordinator-session',
  coordinator_orca_session_id_generation: 4
}

const DISPATCH = { id: 'dispatch_1', task_id: 'task_1', run_id: 'run_1', status: 'dispatched' }
const TASK = {
  id: 'task_1',
  run_id: 'run_1',
  spec: 'Review the diff',
  task_title: 'Review',
  display_name: '',
  created_by_pane_key: null,
  created_by_process_incarnation: null,
  created_by_run_generation: 4,
  creator_dispatch_id: null,
  creator_dispatch_run_id: null,
  creator_dispatch_pane_key: null,
  creator_dispatch_process_incarnation: null
}

function projectionFor(
  options: {
    run?: TestRun
    dispatchFound?: boolean
    workers?: (typeof WORKER)[]
  } = {}
) {
  const db = {
    hasAnyDispatchContexts: () => true,
    getActiveDispatchForTerminal: vi.fn(() =>
      options.dispatchFound === false ? undefined : DISPATCH
    ),
    getLatestDispatchForTerminal: () => undefined,
    getTask: () => TASK,
    getRun: () => options.run ?? COORDINATOR_RUN,
    getCurrentRunForPane: () => undefined,
    getActiveCoordinatorRun: () => undefined,
    getWorkerAttentionFactsForDispatches: () => new Map()
  }
  const projection = new RuntimeAgentOrchestrationProjection({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the projection reads only the database methods faked above.
    getDb: () => db as never,
    getLeaves: () => [],
    getPtys: () => [],
    issueLeafHandle: () => 'unused-leaf-handle',
    issuePtyHandle: () => 'unused-pty-handle',
    makePaneKey: () => 'unused-pane-key',
    getWorktreeId: () => null,
    getHandleForPaneKey: () => null,
    getPaneKey: () => null,
    getDispatchAuthority: () => null,
    getAgentStatusSnapshot: () => [],
    getStructuredWorkers: () => options.workers ?? [WORKER]
  })
  return { projection, db }
}

describe('structured workers in the orchestration projection', () => {
  it('keys a structured worker by its session and nests it under the structured coordinator', () => {
    const { projection } = projectionFor()
    expect(projection.buildByPaneKey()?.[rowKey(WORKER.sessionId)]).toMatchObject({
      dispatchId: 'dispatch_1',
      orchestrationRunId: 'run_1',
      parentPaneKey: rowKey('coordinator-session')
    })
  })

  it('looks a structured worker up by its identity pane, never by the session row key', () => {
    const { projection, db } = projectionFor()
    projection.buildByPaneKey()
    expect(db.getActiveDispatchForTerminal).toHaveBeenCalledWith(WORKER.handle, WORKER.paneKey)
  })

  it('keeps a terminal coordinator nested by its stored pane key', () => {
    const { projection } = projectionFor({
      run: {
        ...COORDINATOR_RUN,
        coordinator_orca_session_id: null,
        coordinator_orca_session_id_generation: null,
        coordinator_pane_key: 'tab-1:leaf-1'
      }
    })
    expect(projection.buildByPaneKey()?.[rowKey(WORKER.sessionId)]).toMatchObject({
      parentPaneKey: 'tab-1:leaf-1'
    })
  })

  it('publishes no context for a structured worker whose dispatch has settled', () => {
    const { projection } = projectionFor({ dispatchFound: false })
    expect(projection.buildByPaneKey()).toBeUndefined()
  })
})
