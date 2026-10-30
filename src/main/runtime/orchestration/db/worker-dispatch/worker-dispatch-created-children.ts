import type { OrchestrationDb } from '../orchestration-db'

/**
 * True when a dispatch created this worktree as a new child. Lineage cannot tell: a worker's child
 * records the same explicit-parent origin as a CLI child, so the dispatch's own effect is the proof.
 */
export function isWorktreeCreatedAsDelegatedChild(
  this: OrchestrationDb,
  worktreeId: string
): boolean {
  const row = this.db
    .prepare(
      `SELECT 1 FROM worker_dispatches, json_each(worker_dispatches.effects) AS effect
       WHERE json_extract(effect.value, '$.kind') = 'worktree'
         AND json_extract(effect.value, '$.action') = 'created_child'
         AND json_extract(effect.value, '$.id') = ?
       LIMIT 1`
    )
    .get(worktreeId)
  return row !== undefined
}

export type WorkerDispatchCreatedChildrenMethods = {
  isWorktreeCreatedAsDelegatedChild: typeof isWorktreeCreatedAsDelegatedChild
}

export function attachWorkerDispatchCreatedChildren(ctor: { prototype: object }): void {
  Object.assign(ctor.prototype, { isWorktreeCreatedAsDelegatedChild })
}
