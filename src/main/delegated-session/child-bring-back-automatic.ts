import type { ChildBringBackPolicy, ChildBringBackStatus } from '../../shared/child-bring-back'
import type { DelegationRequestRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import type { ChildBringBackService } from './child-bring-back'
import {
  readStoredAutomaticBringBack,
  type AutomaticBringBackMark
} from './delegation-stored-request'

/** Bot teams pass `full` the same way; an access the host cannot resolve asks. */
export function childBringBackPolicyOf(access: string | undefined): ChildBringBackPolicy {
  return access === 'full-access' ? 'full' : access === 'auto' ? 'auto' : 'ask'
}

export type ChildBringBackAutomaticDeps = {
  service: Pick<ChildBringBackService, 'status' | 'bringBack' | 'abort' | 'resolveWithAgent'>
  readRequest: (requestId: string) => DelegationRequestRow | undefined
  listFinishedRequests: () => DelegationRequestRow[]
  readWorkspaceId: (sessionId: string) => string | null
  readPolicy: (parentSessionId: string) => ChildBringBackPolicy
  mark: (requestId: string, mark: AutomaticBringBackMark) => void
  tellParent: (parentSessionId: string, text: string) => void
  warn: (message: string, error: unknown) => void
}

function broughtBackMessage(
  title: string,
  ready: Extract<ChildBringBackStatus, { kind: 'ready' }>,
  commit: string
): string {
  const left =
    ready.childUncommitted > 0
      ? ` ${ready.childUncommitted} uncommitted files stayed in the child's worktree.`
      : ''
  return `Child session "${title}" was brought back automatically into ${ready.into} as merge ${commit}: ${ready.commits} commits touching ${ready.files} files are now in this worktree.${left}`
}

/** Decides, from the parent's access, when Bring back runs without being asked. */
export class ChildBringBackAutomatic {
  private readonly queues = new Map<string, Promise<void>>()

  constructor(private readonly deps: ChildBringBackAutomaticDeps) {}

  onChildFinished(requestId: string): Promise<void> {
    const row = this.deps.readRequest(requestId)
    if (!row || this.deps.readPolicy(row.parent_session_id) === 'ask') {
      return Promise.resolve()
    }
    return this.enqueue(row)
  }

  /** Retries only what is waiting on this session, never an older notice left for the person. */
  async onTurnEnded(sessionId: string): Promise<void> {
    const waiting = this.deps.listFinishedRequests().filter((row) => {
      const mark = readStoredAutomaticBringBack(row)
      return (
        (row.child_session_id === sessionId && mark === 'child-finishing') ||
        (row.parent_session_id === sessionId && (mark === 'waiting' || mark === 'asked-commit'))
      )
    })
    await Promise.all(waiting.map((row) => this.enqueue(row)))
  }

  /** Picks up what a restart interrupted. */
  async reconcile(): Promise<void> {
    const waiting = this.deps.listFinishedRequests().filter((row) => {
      const mark = readStoredAutomaticBringBack(row)
      return mark === 'child-finishing' || mark === 'waiting' || mark === 'asked-commit'
    })
    await Promise.all(waiting.map((row) => this.enqueue(row)))
  }

  /** One at a time per parent worktree, because a merge holds that worktree's index. */
  private enqueue(row: DelegationRequestRow): Promise<void> {
    const key = this.deps.readWorkspaceId(row.parent_session_id) ?? row.parent_session_id
    const next = (this.queues.get(key) ?? Promise.resolve())
      .then(() => this.attempt(row.id))
      .catch((error: unknown) => {
        this.deps.warn(`automatic bring back of ${row.id} failed`, error)
      })
    this.queues.set(key, next)
    return next
  }

  private async attempt(requestId: string): Promise<void> {
    const { deps } = this
    const row = deps.readRequest(requestId)
    if (!row) {
      return
    }
    const policy = deps.readPolicy(row.parent_session_id)
    const status = await deps.service.status(requestId)
    if (status.kind === 'running') {
      deps.mark(requestId, 'child-finishing')
      return
    }
    if (policy === 'ask' || status.kind !== 'ready') {
      return
    }
    if (policy === 'auto' && (status.block !== null || (status.predictedConflicts ?? 0) > 0)) {
      deps.mark(requestId, 'notice')
      return
    }
    // A detached HEAD has nowhere to merge into, and only a person can change that.
    if (status.block === 'parent-no-branch' && status.into === '') {
      deps.mark(requestId, 'notice')
      return
    }
    // With a branch, this block is an operation running, such as a sibling child's merge.
    if (
      status.block === 'parent-no-branch' ||
      status.block === 'parent-working' ||
      status.automatic === 'waiting'
    ) {
      deps.mark(requestId, 'waiting')
      return
    }
    if (status.block === 'parent-uncommitted') {
      if (readStoredAutomaticBringBack(row) !== 'asked-commit') {
        deps.mark(requestId, 'asked-commit')
        deps.tellParent(
          row.parent_session_id,
          `Child session "${row.title}" finished and is waiting to be brought back into this worktree, which has uncommitted changes. Commit the work you mean to keep; the merge runs when your turn ends.`
        )
      }
      return
    }
    await this.merge(row, status, policy)
  }

  private async merge(
    row: DelegationRequestRow,
    ready: Extract<ChildBringBackStatus, { kind: 'ready' }>,
    policy: ChildBringBackPolicy
  ): Promise<void> {
    const { deps } = this
    const after = await deps.service.bringBack(row.id).catch((error: unknown) => {
      // The notice keeps the action, and clicking it shows Git's own reason.
      deps.warn(`automatic bring back of ${row.id} failed`, error)
      deps.mark(row.id, 'notice')
      return null
    })
    if (after?.kind === 'brought-back') {
      deps.mark(row.id, 'merged')
      deps.tellParent(row.parent_session_id, broughtBackMessage(row.title, ready, after.commit))
    } else if (after?.kind === 'conflicts' && policy === 'full') {
      deps.mark(row.id, 'resolving')
      await deps.service.resolveWithAgent(row.id)
    } else if (after?.kind === 'conflicts') {
      await deps.service.abort(row.id)
      deps.mark(row.id, 'undone')
    } else if (after?.kind === 'ready' && policy === 'full') {
      // The parent started a turn between the read and the merge.
      deps.mark(row.id, 'waiting')
    }
  }
}
