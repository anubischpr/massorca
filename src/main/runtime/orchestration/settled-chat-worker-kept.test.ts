import { describe, expect, it } from 'vitest'
import type {
  FleetDurableWorker,
  FleetLiveness
} from '../../../shared/orchestration-fleet-projection'
import { projectFleetNextAction } from '../../../shared/orchestration-fleet-worker-projection'
import { deriveWorkerTerminalListState } from './worker-terminal-ownership'

const LIVE: FleetLiveness = { verdict: 'live', observedAt: 0, source: 'agent_status' }
const OWNED = { ownership_state: 'owned', release_state: 'not_requested' } as const

function settledWorker(handle: string): FleetDurableWorker {
  return {
    dispatchId: 'ctx_1',
    taskId: 'task_1',
    runId: 'run_1',
    parentTaskId: null,
    workerState: 'succeeded',
    dispatchStatus: 'completed',
    workerStage: null,
    agentTerminalHandle: handle,
    paneKey: null,
    worktreeId: 'wt-child',
    terminalState: deriveWorkerTerminalListState({
      workerState: 'succeeded',
      agentTerminalHandle: handle,
      resource: OWNED
    }),
    resource: {
      id: 'wtr_1',
      ownerDispatchId: 'ctx_1',
      worktreeId: 'wt-child',
      paneKey: null,
      hostScope: null,
      ownershipState: 'owned',
      releaseState: 'not_requested',
      updatedAt: '2026-11-08 20:27:46'
    }
  }
}

describe('a child chat that reported its result', () => {
  it('stays open for follow-up tasks instead of owing a release', () => {
    expect(
      deriveWorkerTerminalListState({
        workerState: 'succeeded',
        agentTerminalHandle: 'structworker_child',
        resource: OWNED
      })
    ).toBe('retained')
  })

  it('points the parent at no release command', () => {
    const worker = settledWorker('structworker_child')

    expect(projectFleetNextAction(worker, LIVE).kind).toBe('none')
  })

  it('still owes a release for a settled terminal worker', () => {
    expect(
      deriveWorkerTerminalListState({
        workerState: 'succeeded',
        agentTerminalHandle: 'term_child',
        resource: OWNED
      })
    ).toBe('reclaimable')
    const worker = settledWorker('term_child')

    expect(projectFleetNextAction(worker, LIVE).argv).toEqual([
      'orchestration',
      'worker-release',
      '--dispatch',
      'ctx_1'
    ])
  })
})
