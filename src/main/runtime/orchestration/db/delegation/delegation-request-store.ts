import { z } from 'zod'
import type { OrchestrationDb } from '../orchestration-db'
import { generateId } from '../generated-id'

export type DelegationRequestStatus =
  | 'pending'
  | 'starting'
  | 'started'
  | 'failed'
  | 'cancelled'
  | 'finished'

export type DelegationRequestRow = {
  id: string
  run_id: string | null
  parent_session_id: string
  title: string
  summary: string
  prompt: string
  writes: number
  workspace_kind: 'git' | 'folder'
  options_json: string
  decision_json: string | null
  choice: string | null
  status: DelegationRequestStatus
  question_item_id: string | null
  task_id: string | null
  dispatch_id: string | null
  child_session_id: string | null
  result: string | null
  failure: string | null
  launched_at_ms: number | null
  created_at: string
  updated_at: string
}

/** The columns a request's later life writes; everything else is fixed when it is filed. */
export type DelegationRequestPatch = Partial<
  Pick<
    DelegationRequestRow,
    | 'run_id'
    | 'decision_json'
    | 'choice'
    | 'question_item_id'
    | 'task_id'
    | 'dispatch_id'
    | 'child_session_id'
    | 'result'
    | 'failure'
    | 'launched_at_ms'
  >
>

const PATCH_COLUMNS = new Set<string>([
  'run_id',
  'decision_json',
  'choice',
  'question_item_id',
  'task_id',
  'dispatch_id',
  'child_session_id',
  'result',
  'failure',
  'launched_at_ms'
])

export function createDelegationRequest(
  this: OrchestrationDb,
  params: {
    parentSessionId: string
    title: string
    summary: string
    prompt: string
    writes: boolean
    workspaceKind: 'git' | 'folder'
    optionsJson: string
    decisionJson: string | null
  }
): DelegationRequestRow {
  const id = generateId('deleg')
  this.db
    .prepare(
      `INSERT INTO delegation_requests (
         id, parent_session_id, title, summary, prompt, writes, workspace_kind,
         options_json, decision_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.parentSessionId,
      params.title,
      params.summary,
      params.prompt,
      params.writes ? 1 : 0,
      params.workspaceKind,
      params.optionsJson,
      params.decisionJson
    )
  const row = this.getDelegationRequest(id)
  if (!row) {
    throw new Error(`Delegation request ${id} was not stored.`)
  }
  return row
}

export function getDelegationRequest(
  this: OrchestrationDb,
  id: string
): DelegationRequestRow | undefined {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: delegation_requests rows are written only by this store, with the DelegationRequestRow columns.
  return this.db.prepare('SELECT * FROM delegation_requests WHERE id = ?').get(id) as
    | DelegationRequestRow
    | undefined
}

export function getDelegationRequestByDispatch(
  this: OrchestrationDb,
  dispatchId: string
): DelegationRequestRow | undefined {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: delegation_requests rows are written only by this store, with the DelegationRequestRow columns.
  return this.db
    .prepare('SELECT * FROM delegation_requests WHERE dispatch_id = ?')
    .get(dispatchId) as DelegationRequestRow | undefined
}

export function listDelegationRequestsByStatus(
  this: OrchestrationDb,
  status: DelegationRequestStatus
): DelegationRequestRow[] {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: delegation_requests rows are written only by this store, with the DelegationRequestRow columns.
  return this.db
    .prepare('SELECT * FROM delegation_requests WHERE status = ? ORDER BY created_at, id')
    .all(status) as DelegationRequestRow[]
}

/**
 * Moves a request from `from` to `to` in one statement, so two callers racing for the same step
 * cannot both win it. `patch` is written with the move. Returns the row after, or null when the
 * request was not in a `from` status.
 */
export function transitionDelegationRequest(
  this: OrchestrationDb,
  id: string,
  from: DelegationRequestStatus | readonly DelegationRequestStatus[],
  to: DelegationRequestStatus,
  patch: DelegationRequestPatch = {}
): DelegationRequestRow | null {
  const allowed = typeof from === 'string' ? [from] : [...from]
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined)
  for (const [column] of entries) {
    if (!PATCH_COLUMNS.has(column)) {
      throw new Error(`Unsupported delegation request column: ${column}`)
    }
  }
  const assignments = [
    'status = ?',
    "updated_at = datetime('now')",
    ...entries.map(([column]) => `${column} = ?`)
  ]
  const result = this.db
    .prepare(
      `UPDATE delegation_requests SET ${assignments.join(', ')}
       WHERE id = ? AND status IN (${allowed.map(() => '?').join(', ')})`
    )
    .run(to, ...entries.map(([, value]) => value), id, ...allowed)
  return result.changes === 1 ? (this.getDelegationRequest(id) ?? null) : null
}

/** Writes columns without moving the status; for facts learned while a request stays where it is. */
export function patchDelegationRequest(
  this: OrchestrationDb,
  id: string,
  patch: DelegationRequestPatch
): void {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined)
  if (entries.length === 0) {
    return
  }
  for (const [column] of entries) {
    if (!PATCH_COLUMNS.has(column)) {
      throw new Error(`Unsupported delegation request column: ${column}`)
    }
  }
  this.db
    .prepare(
      `UPDATE delegation_requests SET updated_at = datetime('now'), ${entries
        .map(([column]) => `${column} = ?`)
        .join(', ')} WHERE id = ?`
    )
    .run(...entries.map(([, value]) => value), id)
}

const DelegatedChildLinkRowSchema = z.object({
  child_session_id: z.string(),
  parent_session_id: z.string(),
  run_id: z.string().nullable(),
  task_id: z.string(),
  dispatch_id: z.string(),
  // Why: an unknown status drops only the status, never the parent link.
  dispatch_status: z
    .enum(['pending', 'dispatched', 'completed', 'failed', 'circuit_broken'])
    .nullable()
    .catch(null),
  task_spec: z.string().nullable(),
  task_title: z.string().nullable(),
  display_name: z.string().nullable()
})

export type DelegatedChildLinkRow = z.infer<typeof DelegatedChildLinkRowSchema>

// Why: bounded to the given sessions, so the map tracks live rows rather than lifetime delegations.
export function listDelegatedChildLinks(
  this: OrchestrationDb,
  sessionIds: readonly string[]
): DelegatedChildLinkRow[] {
  const ids = JSON.stringify(sessionIds)
  return this.db
    .prepare(
      `SELECT r.child_session_id, r.parent_session_id, r.run_id, r.task_id, r.dispatch_id,
              d.status AS dispatch_status, t.spec AS task_spec, t.task_title, t.display_name
       FROM delegation_requests r
       LEFT JOIN dispatch_contexts d ON d.id = r.dispatch_id
       LEFT JOIN tasks t ON t.id = r.task_id
       WHERE r.child_session_id IN (SELECT value FROM json_each(?))
         AND r.parent_session_id IN (SELECT value FROM json_each(?))
         AND r.task_id IS NOT NULL AND r.dispatch_id IS NOT NULL
       ORDER BY r.created_at, r.id`
    )
    .all(ids, ids)
    .flatMap((row) => {
      const parsed = DelegatedChildLinkRowSchema.safeParse(row)
      return parsed.success ? [parsed.data] : []
    })
}

export type DelegationRequestStoreMethods = {
  createDelegationRequest: typeof createDelegationRequest
  getDelegationRequest: typeof getDelegationRequest
  getDelegationRequestByDispatch: typeof getDelegationRequestByDispatch
  listDelegationRequestsByStatus: typeof listDelegationRequestsByStatus
  transitionDelegationRequest: typeof transitionDelegationRequest
  patchDelegationRequest: typeof patchDelegationRequest
  listDelegatedChildLinks: typeof listDelegatedChildLinks
}

export function attachDelegationRequestStore(ctor: { prototype: object }): void {
  Object.assign(ctor.prototype, {
    createDelegationRequest,
    getDelegationRequest,
    getDelegationRequestByDispatch,
    listDelegationRequestsByStatus,
    transitionDelegationRequest,
    patchDelegationRequest,
    listDelegatedChildLinks
  })
}
