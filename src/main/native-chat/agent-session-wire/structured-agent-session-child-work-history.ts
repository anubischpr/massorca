// What a chat remembers of its finished child work once the status store lets go of it.
//
// The store keeps a settled child only until the user's next turn and holds everything in memory,
// so the Subagents and Background tasks cards lost their finished lists on the next send, and on
// every host restart. This keeps a bounded list per chat and kind, with no clock: a child leaves it
// only when newer ones push it past the bound, or when its chat's record is deleted. The list is
// written to the chat database; a child that was still running when the host stopped comes back
// as finished with an `unknown` outcome, never as running.

import type { AgentChildWorkKind } from '../../../shared/agent-status-child-work'
import type { AgentChildWorkView } from '../../../shared/agent-status-child-work-view'
import { decodeAgentChildWorkViews } from '../../../shared/agent-status-child-work-view-wire'
import type { ChildWorkHistoryRows } from '../agent-session-journal/child-work-history-rows'

export const MAX_SETTLED_CHILD_WORK_PER_KIND = 50
/** A guard on one stored row's length; descriptions are the only large part. */
const MAX_HISTORY_ROW_CHARS = 1024 * 1024
const ROW_VERSION = 1

type SessionHistory = {
  /** Settled children, oldest first. */
  settled: AgentChildWorkView[]
  /** The newest view of every child still running, kept so a host stop can end it as interrupted. */
  live: AgentChildWorkView[]
}

function settledClock(view: AgentChildWorkView): number {
  return view.settledAt ?? view.observedAt
}

/** The same provider child, seen again under a record id this host minted later. */
function sameChild(left: AgentChildWorkView, right: AgentChildWorkView): boolean {
  return (
    left.id === right.id ||
    (left.providerId !== undefined &&
      left.providerId === right.providerId &&
      left.kind === right.kind)
  )
}

function interrupted(view: AgentChildWorkView): AgentChildWorkView {
  const { operation: _operation, ...rest } = view
  return {
    ...rest,
    state: 'done',
    membership: 'settled',
    outcome: 'unknown',
    settledAt: view.observedAt,
    stoppable: false
  }
}

function boundedPerKind(settled: AgentChildWorkView[]): AgentChildWorkView[] {
  const sorted = [...settled].sort((left, right) => settledClock(left) - settledClock(right))
  const kept = new Map<AgentChildWorkKind, number>()
  return sorted
    .toReversed()
    .filter((view) => {
      const count = kept.get(view.kind) ?? 0
      kept.set(view.kind, count + 1)
      return count < MAX_SETTLED_CHILD_WORK_PER_KIND
    })
    .toReversed()
}

function signature(history: SessionHistory): string {
  return [...history.settled, ...history.live]
    .map((view) => `${view.id}|${view.membership}|${view.outcome ?? ''}|${view.providerId ?? ''}`)
    .join('\n')
}

export class StructuredAgentSessionChildWorkHistory {
  private readonly sessions = new Map<string, SessionHistory>()
  /** The signature of what each chat's row holds, so unchanged state is not written again. */
  private readonly written = new Map<string, string>()

  constructor(private readonly rows: ChildWorkHistoryRows) {}

  /** Folds the store's current records in; called after every edge that can change them, and
   *  before the one that retires settled children. */
  observe(sessionId: string, views: readonly AgentChildWorkView[]): void {
    const history = this.history(sessionId)
    const settledNow = views.filter((view) => view.membership === 'settled')
    const liveNow = views.filter((view) => view.membership === 'live')
    history.settled = boundedPerKind([
      ...history.settled.filter((old) => !views.some((view) => sameChild(view, old))),
      ...settledNow
    ])
    history.live = liveNow
    this.persist(sessionId, history)
  }

  /** The chat's session ended: whatever still ran can no longer report its own ending. */
  interrupt(sessionId: string): void {
    const history = this.history(sessionId)
    if (history.live.length === 0) {
      return
    }
    history.settled = boundedPerKind([...history.settled, ...history.live.map(interrupted)])
    history.live = []
    this.persist(sessionId, history)
  }

  /** The views a client reads: the store's records, then the finished children it no longer holds.
   *  A newer record of the same child wins over its remembered one. */
  compose(sessionId: string, views: readonly AgentChildWorkView[]): AgentChildWorkView[] {
    const remembered = this.history(sessionId).settled.filter(
      (old) => !views.some((view) => sameChild(view, old))
    )
    if (remembered.length === 0) {
      return [...views]
    }
    const present = new Set([...views, ...remembered].map((view) => view.id))
    return [
      ...views,
      ...remembered.map((view) =>
        view.parentChildWorkId === undefined || present.has(view.parentChildWorkId)
          ? view
          : withoutOwner(view)
      )
    ]
  }

  private history(sessionId: string): SessionHistory {
    const held = this.sessions.get(sessionId)
    if (held) {
      return held
    }
    const loaded = this.load(sessionId)
    this.sessions.set(sessionId, loaded)
    return loaded
  }

  private load(sessionId: string): SessionHistory {
    const raw = this.rows.read(sessionId)
    const views = raw === null ? [] : decodeRow(raw)
    // Anything a previous host left running is over: this host holds no process for it.
    const history: SessionHistory = {
      settled: boundedPerKind(
        views.map((view) => (view.membership === 'live' ? interrupted(view) : view))
      ),
      live: []
    }
    if (raw !== null) {
      this.written.set(sessionId, signature({ settled: views, live: [] }))
    }
    return history
  }

  private persist(sessionId: string, history: SessionHistory): void {
    const next = signature(history)
    if (next === this.written.get(sessionId)) {
      return
    }
    const everything = [...history.settled, ...history.live]
    if (everything.length === 0) {
      this.rows.write(sessionId, null)
      this.written.set(sessionId, next)
      return
    }
    const value = encodeRow(everything)
    this.rows.write(sessionId, value)
    this.written.set(sessionId, next)
  }
}

function withoutOwner(view: AgentChildWorkView): AgentChildWorkView {
  const { parentChildWorkId: _owner, ...rest } = view
  return { ...rest, ownership: 'unverifiable' }
}

function decodeRow(raw: string): AgentChildWorkView[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || !('views' in parsed)) {
      return []
    }
    return decodeAgentChildWorkViews(parsed.views) ?? []
  } catch {
    return []
  }
}

/** Oldest settled children go first when the row would pass its length guard. */
function encodeRow(views: AgentChildWorkView[]): string {
  let kept = views
  let value = JSON.stringify({ v: ROW_VERSION, views: kept })
  while (value.length > MAX_HISTORY_ROW_CHARS && kept.length > 1) {
    kept = kept.slice(Math.ceil(kept.length / 10))
    value = JSON.stringify({ v: ROW_VERSION, views: kept })
  }
  return value
}
