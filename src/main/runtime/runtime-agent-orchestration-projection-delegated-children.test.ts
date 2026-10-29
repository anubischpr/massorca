import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../shared/structured-agent-session-projection'
import { OrchestrationDb } from './orchestration/db'
import { RuntimeAgentOrchestrationProjection } from './runtime-agent-orchestration-projection'

const SYSTEM = { kind: 'system' } as const
const PARENT = 'parent-chat'
const CHILD = 'child-session'
const CHILD_HANDLE = 'structworker_child'
const CHILD_PANE = 'structured-agent-session-child-session:4f9c1d2e-8a7b-4c6d-9e0f-1a2b3c4d5e6f'
const WORKER = { handle: CHILD_HANDLE, paneKey: CHILD_PANE, sessionId: CHILD }
const FILED = {
  parentSessionId: PARENT,
  title: 'Review the diff',
  summary: 'Review the diff',
  prompt: 'Review the diff and list the risks.',
  writes: false,
  workspaceKind: 'git' as const,
  optionsJson: '[]',
  decisionJson: null
}

const rowKey = (sessionId: string): string =>
  structuredAgentSessionPaneKey(structuredAgentSessionTabId(sessionId), sessionId)
const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

let db: OrchestrationDb | undefined
let tempDir: string | undefined

afterEach(() => {
  db?.close()
  db = undefined
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    tempDir = undefined
  }
})

/** Creates the child's dispatch, then files and starts the request the way the launcher records it. */
function startDelegatedChild(store: OrchestrationDb): string {
  const task = store.createTask({
    runId: 'run_legacy_local',
    spec: 'Review the diff\n\nList the risks.'
  })
  const dispatch = store.createDispatchContext({
    taskId: task.id,
    assigneeHandle: CHILD_HANDLE,
    assigneePaneKey: CHILD_PANE,
    creator: SYSTEM,
    maxDepth: Number.MAX_SAFE_INTEGER
  })
  const { id } = store.createDelegationRequest(FILED)
  store.transitionDelegationRequest(id, 'pending', 'starting')
  store.transitionDelegationRequest(id, 'starting', 'started', {
    run_id: dispatch.run_id,
    task_id: task.id,
    dispatch_id: dispatch.id,
    child_session_id: CHILD
  })
  return dispatch.id
}

function settleDispatch(
  store: OrchestrationDb,
  dispatchId: string,
  status: 'completed' | 'failed',
  completedAt: string
): void {
  store.db
    .prepare('UPDATE dispatch_contexts SET status = ?, completed_at = ? WHERE id = ?')
    .run(status, completedAt, dispatchId)
}

function projectionFor(
  store: OrchestrationDb,
  workers: readonly (typeof WORKER)[] = []
): RuntimeAgentOrchestrationProjection {
  return new RuntimeAgentOrchestrationProjection({
    getDb: () => store,
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
    getStructuredWorkers: () => workers
  })
}

describe('delegated children in the orchestration projection', () => {
  it('nests a child whose dispatch is still open, while it works or sits idle', () => {
    db = new OrchestrationDb(':memory:')
    const dispatchId = startDelegatedChild(db)

    const contexts = projectionFor(db, [WORKER]).buildByPaneKey()

    expect(contexts?.[rowKey(CHILD)]).toMatchObject({
      dispatchId,
      parentPaneKey: rowKey(PARENT)
    })
  })

  it('keeps the nesting after the child finished, past the stale window, with no live worker', () => {
    db = new OrchestrationDb(':memory:')
    const dispatchId = startDelegatedChild(db)
    settleDispatch(db, dispatchId, 'completed', hoursAgo(3))

    // Why: no registry entry, as after a stop or abandon; the persisted record alone nests the child.
    const contexts = projectionFor(db, []).buildByPaneKey()

    expect(contexts?.[rowKey(CHILD)]).toMatchObject({
      dispatchId,
      dispatchStatus: 'completed',
      taskTitle: 'Review the diff',
      parentPaneKey: rowKey(PARENT)
    })
  })

  it('keeps the nesting when the child failed', () => {
    db = new OrchestrationDb(':memory:')
    const dispatchId = startDelegatedChild(db)
    settleDispatch(db, dispatchId, 'failed', hoursAgo(1))

    const contexts = projectionFor(db, [WORKER]).buildByPaneKey()

    expect(contexts?.[rowKey(CHILD)]).toMatchObject({
      dispatchStatus: 'failed',
      parentPaneKey: rowKey(PARENT)
    })
  })

  it('rebuilds the nesting after a restart from the persisted record alone', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'orca-delegated-child-restart-'))
    const path = join(tempDir, 'orchestration.db')
    const first = new OrchestrationDb(path)
    settleDispatch(first, startDelegatedChild(first), 'completed', hoursAgo(3))
    first.close()

    db = new OrchestrationDb(path)
    // Why: a restart leaves no registry entry and no live dispatch, only the persisted rows.
    const contexts = projectionFor(db, []).buildByPaneKey()

    expect(contexts?.[rowKey(CHILD)]).toMatchObject({
      parentPaneKey: rowKey(PARENT),
      dispatchStatus: 'completed',
      taskTitle: 'Review the diff'
    })
  })

  it('keeps a child live dispatch over the recorded one and takes the recorded parent', () => {
    db = new OrchestrationDb(':memory:')
    settleDispatch(db, startDelegatedChild(db), 'completed', hoursAgo(3))
    const task = db.createTask({ runId: 'run_legacy_local', spec: 'Second turn' })
    const live = db.createDispatchContext({
      taskId: task.id,
      assigneeHandle: CHILD_HANDLE,
      assigneePaneKey: CHILD_PANE,
      creator: SYSTEM,
      maxDepth: Number.MAX_SAFE_INTEGER
    })

    const contexts = projectionFor(db, [WORKER]).buildByPaneKey()

    expect(contexts?.[rowKey(CHILD)]).toMatchObject({
      dispatchId: live.id,
      parentPaneKey: rowKey(PARENT)
    })
  })

  it('publishes no context for a settled worker that no delegation started', () => {
    db = new OrchestrationDb(':memory:')
    const task = db.createTask({ runId: 'run_legacy_local', spec: 'Own worker' })
    const dispatch = db.createDispatchContext({
      taskId: task.id,
      assigneeHandle: CHILD_HANDLE,
      assigneePaneKey: CHILD_PANE,
      creator: SYSTEM,
      maxDepth: Number.MAX_SAFE_INTEGER
    })
    settleDispatch(db, dispatch.id, 'completed', hoursAgo(3))

    expect(projectionFor(db, [WORKER]).buildByPaneKey()).toBeUndefined()
  })

  it('publishes nothing when neither a dispatch nor a delegation record exists', () => {
    db = new OrchestrationDb(':memory:')

    expect(projectionFor(db, [WORKER]).buildByPaneKey()).toBeUndefined()
  })
})
