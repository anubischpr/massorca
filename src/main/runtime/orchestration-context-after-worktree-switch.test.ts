// A worktree switch publishes a renderer graph without the other worktree's tabs. The worker's PTY is
// still alive, so its orchestration context and parent link must survive that graph.
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OrcaRuntimeService } from './orca-runtime'
import { OrchestrationDb } from './orchestration/db'
import { createRootDispatch } from './orchestration/db/root-dispatch-test-fixture'

const COORDINATOR_WORKTREE_ID = 'repo-switch::/tmp/switch-coordinator'
const WORKER_WORKTREE_ID = 'repo-switch::/tmp/switch-worker'
const COORDINATOR = {
  tabId: 'tab-coordinator',
  leafId: '11111111-1111-4111-8111-111111111111',
  ptyId: 'pty-coordinator',
  handle: 'term_coordinator',
  worktreeId: COORDINATOR_WORKTREE_ID
}
const WORKER = {
  tabId: 'tab-worker',
  leafId: '22222222-2222-4222-8222-222222222222',
  ptyId: 'pty-worker',
  handle: 'term_worker',
  worktreeId: WORKER_WORKTREE_ID
}

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function paneKeyOf(terminal: { tabId: string; leafId: string }): string {
  return `${terminal.tabId}:${terminal.leafId}`
}

function graphOf(terminals: readonly (typeof COORDINATOR)[]) {
  return {
    tabs: terminals.map((terminal) => ({
      tabId: terminal.tabId,
      worktreeId: terminal.worktreeId,
      title: terminal.tabId,
      activeLeafId: terminal.leafId,
      layout: null
    })),
    leaves: terminals.map((terminal, index) => ({
      tabId: terminal.tabId,
      worktreeId: terminal.worktreeId,
      leafId: terminal.leafId,
      paneRuntimeId: index + 1,
      ptyId: terminal.ptyId
    }))
  }
}

describe('orchestration context across a worktree switch', () => {
  it('keeps a live worker context and its parent link when its worktree leaves the graph', () => {
    const directory = mkdtempSync(join(tmpdir(), 'worktree-switch-context-'))
    directories.push(directory)
    const db = new OrchestrationDb(join(directory, 'orchestration.db'))
    const runtime = new OrcaRuntimeService(null)
    try {
      runtime.setOrchestrationDb(db)
      runtime.setPtyController({
        write: () => true,
        kill: () => true,
        getForegroundProcess: async () => null
      })
      for (const terminal of [COORDINATOR, WORKER]) {
        runtime.registerPty(terminal.ptyId, terminal.worktreeId, null, {
          tabId: terminal.tabId,
          leafId: terminal.leafId,
          incarnationId: `${terminal.ptyId}-incarnation`
        })
        runtime.registerPreAllocatedHandleForPty(terminal.ptyId, terminal.handle)
      }
      runtime.attachWindow(1)
      runtime.syncWindowGraph(1, graphOf([COORDINATOR, WORKER]))
      const run = db.createRun({
        objective: 'own the worker',
        coordinatorHandle: COORDINATOR.handle,
        coordinatorPaneKey: paneKeyOf(COORDINATOR)
      })
      const task = db.createTask({ spec: 'worker work', runId: run.id })
      const dispatch = createRootDispatch(db, task.id, WORKER.handle, paneKeyOf(WORKER))
      const linked = {
        dispatchId: dispatch.id,
        parentPaneKey: paneKeyOf(COORDINATOR)
      }

      expect(
        runtime.syncWindowGraph(1, graphOf([COORDINATOR, WORKER])).agentOrchestrationByPaneKey?.[
          paneKeyOf(WORKER)
        ]
      ).toMatchObject(linked)

      // Switching to the coordinator's worktree publishes only its tab.
      const afterSwitch = runtime.syncWindowGraph(1, graphOf([COORDINATOR])).agentOrchestrationByPaneKey

      expect(afterSwitch?.[paneKeyOf(WORKER)]).toMatchObject(linked)
    } finally {
      db.close()
    }
  })
})
