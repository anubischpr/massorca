import {
  delegationNoticeRowIdentity,
  type DelegationFailedPayload,
  type DelegationFinishedPayload,
  type DelegationNoticePayload,
  type DelegationStartedPayload
} from '../../shared/delegated-session-journal'
import type { AgentJournalStatusItem } from '../../shared/agent-session-journal-types'
import type { DelegationRequestRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import {
  delegationFailedNotice,
  delegationFinishedNotice,
  delegationStartedNotice,
  summarizeDelegationResult
} from './delegation-notices'
import type { DelegationAnswerDeps, DelegationLaunchResult } from './delegation-launch-types'
import { TERMINAL_DISPATCH_STATUSES } from '../runtime/orchestration/db/dispatch-settlement-observers'
import { resolveDelegationTarget } from './delegation-stored-request'

/** Starts the child an answered request asked for and reports how it ends to the parent chat. */
export class DelegationLifecycle {
  private readonly inFlight = new Set<Promise<void>>()
  private readonly launching = new Set<string>()
  private readonly finishing = new Set<string>()

  constructor(private readonly deps: DelegationAnswerDeps) {}

  /** Starts an answered request's child once; a second call while it starts does nothing. */
  start(requestId: string): void {
    if (this.launching.has(requestId)) {
      return
    }
    this.launching.add(requestId)
    this.track(
      this.launch(requestId).finally(() => {
        this.launching.delete(requestId)
      })
    )
  }

  /** A dispatch reached a terminal state: finishes its request, if it has one still running. */
  onDispatchSettled(dispatchId: string): Promise<void> {
    return this.track(this.finish(dispatchId))
  }

  async idle(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.allSettled(this.inFlight)
    }
  }

  /**
   * What a host restart left half done: an answered request that never started its child fails, and
   * a started one whose dispatch ended while nothing was listening finishes now.
   */
  async reconcile(): Promise<void> {
    const db = this.deps.getDb()
    if (!db) {
      return
    }
    for (const row of db.listDelegationRequestsByStatus('starting')) {
      if (this.launching.has(row.id)) {
        continue
      }
      if (row.dispatch_id) {
        // The worker started; only the row missed hearing so.
        db.transitionDelegationRequest(row.id, 'starting', 'started', {
          child_session_id: db.getDispatchContextById(row.dispatch_id)?.assignee_orca_session_id,
          launched_at_ms: this.deps.now()
        })
      } else {
        await this.fail(row, 'The host restarted before the child session started.')
      }
    }
    for (const row of db.listDelegationRequestsByStatus('started')) {
      if (row.dispatch_id) {
        await this.finish(row.dispatch_id)
      }
    }
  }

  private track(work: Promise<void>): Promise<void> {
    const guarded = work.catch((error: unknown) => {
      this.deps.warn('a delegated session step failed', error)
    })
    this.inFlight.add(guarded)
    void guarded.finally(() => this.inFlight.delete(guarded))
    return guarded
  }

  private async launch(requestId: string): Promise<void> {
    const db = this.deps.getDb()
    const row = db?.getDelegationRequest(requestId)
    if (!db || !row || row.status !== 'starting' || row.dispatch_id) {
      return
    }
    const parent = this.deps.readParent(row.parent_session_id)
    const target = resolveDelegationTarget(row)
    if (!parent || !target) {
      await this.fail(
        row,
        parent ? 'No agent has headroom right now.' : 'The parent chat is no longer available.'
      )
      return
    }
    let launched: DelegationLaunchResult
    try {
      launched = await this.deps.launch({
        request: row,
        parent,
        target,
        record: (patch) => db.patchDelegationRequest(requestId, patch)
      })
    } catch (error) {
      await this.fail(row, error instanceof Error ? error.message : String(error))
      return
    }
    const started = db.transitionDelegationRequest(requestId, 'starting', 'started', {
      run_id: launched.runId,
      task_id: launched.taskId,
      dispatch_id: launched.dispatchId,
      child_session_id: launched.childSessionId,
      launched_at_ms: this.deps.now()
    })
    if (!started) {
      return
    }
    if (launched.childSessionId) {
      const payload: DelegationStartedPayload = {
        requestId,
        title: row.title,
        status: 'started',
        agent: target.agent,
        model: target.model,
        effort: target.effort,
        childSessionId: launched.childSessionId,
        placement: target.placement,
        automatic: target.automatic
      }
      await this.postNotice(row, payload, delegationStartedNotice(payload, target.label))
    }
    // A worker that reported before this row said started is finished now.
    await this.finish(launched.dispatchId)
  }

  private async fail(row: DelegationRequestRow, reason: string): Promise<void> {
    const db = this.deps.getDb()
    const failed = db?.transitionDelegationRequest(row.id, ['pending', 'starting'], 'failed', {
      failure: reason
    })
    if (!failed) {
      return
    }
    const payload: DelegationFailedPayload = {
      requestId: row.id,
      title: row.title,
      status: 'failed',
      reason
    }
    await this.postNotice(row, payload, delegationFailedNotice(payload))
  }

  private async finish(dispatchId: string): Promise<void> {
    if (this.finishing.has(dispatchId)) {
      return
    }
    this.finishing.add(dispatchId)
    try {
      await this.finishOnce(dispatchId)
    } finally {
      this.finishing.delete(dispatchId)
    }
  }

  private async finishOnce(dispatchId: string): Promise<void> {
    const db = this.deps.getDb()
    const row = db?.getDelegationRequestByDispatch(dispatchId)
    if (!db || !row || row.status !== 'started') {
      return
    }
    const dispatch = db.getDispatchContextById(dispatchId)
    if (!dispatch || !TERMINAL_DISPATCH_STATUSES.has(dispatch.status)) {
      return
    }
    const outcome = dispatch.status === 'completed' ? 'succeeded' : 'failed'
    const result = (row.task_id ? db.getTask(row.task_id)?.result : null) ?? dispatch.last_failure
    const payload: DelegationFinishedPayload = {
      requestId: row.id,
      title: row.title,
      status: 'finished',
      outcome,
      resultSummary: summarizeDelegationResult(result),
      childSessionId: row.child_session_id,
      durationMs:
        row.launched_at_ms === null ? null : Math.max(0, this.deps.now() - row.launched_at_ms)
    }
    // Post first: a failed post leaves the row started, so the next reconcile retries it.
    if (await this.postNotice(row, payload, delegationFinishedNotice(payload))) {
      db.transitionDelegationRequest(row.id, 'started', 'finished', { result: result ?? '' })
    }
  }

  private async postNotice(
    row: DelegationRequestRow,
    payload: DelegationNoticePayload,
    notice: AgentJournalStatusItem
  ): Promise<boolean> {
    try {
      await this.deps.rows.appendHostRow(
        row.parent_session_id,
        delegationNoticeRowIdentity(row.id, payload.status),
        notice
      )
      return true
    } catch (error) {
      // The request's own record is the truth; a chat that cannot take the row now is still told by it.
      this.deps.warn(`posting the ${payload.status} notice of delegation ${row.id} failed`, error)
      return false
    }
  }
}
