// Work this phone saw running in one chat, kept so a task that ends reads as finished instead of
// vanishing. Hosts list running work only, so "finished" is only ever inferred from absence on a
// feed that is live; a lost feed asserts nothing.

import type { AgentChildRowModel } from '../../../src/shared/agent-child-row-model'

/** Bounds a long session's list; the oldest finished rows fall off first. */
export const MAX_FINISHED_BACKGROUND_ROWS = 30

export type SeenBackgroundWork = {
  /** The chat these rows belong to; another chat starts over. */
  scopeKey: string
  /** The last live version of each row seen, by id. */
  running: ReadonlyMap<string, AgentChildRowModel>
  /** Rows that ended while this phone watched, newest first. */
  finished: readonly AgentChildRowModel[]
}

export function emptySeenBackgroundWork(scopeKey: string): SeenBackgroundWork {
  return { scopeKey, running: new Map(), finished: [] }
}

// The lane cannot say how a row ended, so it reads neutral ("Ended"), never done or failed.
function settledRow(row: AgentChildRowModel, settledAt: number): AgentChildRowModel {
  return {
    ...row,
    displayState: 'idle',
    detail: { kind: 'ended' },
    settled: true,
    settledAt: row.settledAt ?? settledAt,
    canStop: false,
    owned: row.owned.map((owned) => settledRow(owned, settledAt))
  }
}

/**
 * Folds one read of a chat's running rows into what it has seen. Idempotent for one input, and
 * returns `previous` itself when nothing changed, so a caller can hold it in a ref.
 *
 * `hostNow` is on the clock that stamps the rows' `firstObservedAt`, so a finished row's elapsed
 * never subtracts across two machines.
 */
export function foldSeenBackgroundWork(
  previous: SeenBackgroundWork,
  input: {
    scopeKey: string
    rows: readonly AgentChildRowModel[]
    /** The feed is being heard now. Absence on a feed that is not live proves nothing. */
    live: boolean
    hostNow: number
  }
): SeenBackgroundWork {
  const base =
    previous.scopeKey === input.scopeKey ? previous : emptySeenBackgroundWork(input.scopeKey)
  if (!input.live) {
    return base
  }
  const running = new Map<string, AgentChildRowModel>()
  const alreadySettled: AgentChildRowModel[] = []
  for (const row of input.rows) {
    if (row.settled) {
      alreadySettled.push(row)
    } else {
      running.set(row.id, row)
    }
  }
  const departed = [...base.running.values()]
    .filter((row) => !running.has(row.id))
    .map((row) => settledRow(row, input.hostNow))
  const known = new Set(base.finished.map((row) => row.id))
  const ended = [...departed, ...alreadySettled.filter((row) => !known.has(row.id))]
  const finished =
    ended.length === 0 && !base.finished.some((row) => running.has(row.id))
      ? base.finished
      : [
          ...ended,
          // A row that came back (an idle teammate resumed) is running again, not finished.
          ...base.finished.filter(
            (row) => !running.has(row.id) && !ended.some((other) => other.id === row.id)
          )
        ].slice(0, MAX_FINISHED_BACKGROUND_ROWS)
  if (finished === base.finished && sameRows(base.running, running)) {
    return base
  }
  return { scopeKey: base.scopeKey, running, finished }
}

function sameRows(
  left: ReadonlyMap<string, AgentChildRowModel>,
  right: ReadonlyMap<string, AgentChildRowModel>
): boolean {
  if (left.size !== right.size) {
    return false
  }
  for (const [id, row] of right) {
    if (left.get(id) !== row) {
      return false
    }
  }
  return true
}
