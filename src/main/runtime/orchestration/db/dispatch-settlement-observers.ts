import type Database from '../../../sqlite/sync-database'

/** Dispatch states with no way back: the Dispatch is over, whichever way it ended. */
export const TERMINAL_DISPATCH_STATUSES: ReadonlySet<string> = new Set([
  'completed',
  'failed',
  'circuit_broken'
])

type DispatchSettlementObserver = (db: Database.Database, dispatchId: string) => void

const observers = new Set<DispatchSettlementObserver>()

/**
 * Listens for every Dispatch that reaches a terminal state, whichever path settled it (a worker's
 * report, a Task update, a worker that exited). The callback runs after the settling code returns,
 * so it reads the committed state; a transition that rolled back reads as not settled.
 */
export function observeDispatchSettlements(observer: DispatchSettlementObserver): () => void {
  observers.add(observer)
  return () => {
    observers.delete(observer)
  }
}

export function notifyDispatchSettled(db: Database.Database, dispatchId: string): void {
  for (const observer of observers) {
    setImmediate(() => {
      try {
        observer(db, dispatchId)
      } catch (error) {
        console.warn('[orchestration] a dispatch settlement observer threw', error)
      }
    })
  }
}
