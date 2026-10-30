import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'

describe('isWorktreeCreatedAsDelegatedChild', () => {
  let db: OrchestrationDb
  beforeEach(() => {
    db = new OrchestrationDb(':memory:')
  })
  afterEach(() => db.close())

  function dispatchWithEffects(effects: unknown[]) {
    const task = db.createTask({ runId: 'run_legacy_local', spec: 'child work' })
    const { dispatch } = db.createStartingWorkerDispatch({
      taskId: task.id,
      startOptions: {},
      creator: { kind: 'system' },
      maxDepth: 9
    })
    db.recordWorkerStage({
      dispatchId: dispatch.id,
      stage: 'worktree_created',
      worktreeId: 'repo-1::/repo/child',
      effects
    })
  }

  it('is true for a worktree a dispatch created as a new child', () => {
    dispatchWithEffects([{ kind: 'worktree', action: 'created_child', id: 'repo-1::/repo/child' }])
    expect(db.isWorktreeCreatedAsDelegatedChild('repo-1::/repo/child')).toBe(true)
  })

  it('is false for a worktree a dispatch reused or created at top level', () => {
    dispatchWithEffects([
      { kind: 'worktree', action: 'created_top_level', id: 'repo-1::/repo/top' },
      { kind: 'worktree', action: 'reused_current', id: 'repo-1::/repo/parent' }
    ])
    expect(db.isWorktreeCreatedAsDelegatedChild('repo-1::/repo/top')).toBe(false)
    expect(db.isWorktreeCreatedAsDelegatedChild('repo-1::/repo/parent')).toBe(false)
  })

  it('is false for a worktree no dispatch touched', () => {
    expect(db.isWorktreeCreatedAsDelegatedChild('repo-1::/repo/unknown')).toBe(false)
  })
})
