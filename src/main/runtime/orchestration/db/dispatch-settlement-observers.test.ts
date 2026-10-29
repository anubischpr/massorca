import { describe, expect, it, vi } from 'vitest'
import { notifyDispatchSettled, observeDispatchSettlements } from './dispatch-settlement-observers'
import { OrchestrationDb } from './orchestration-db'

/** Observers are told on a later turn of the event loop, after the settling code has returned. */
const nextTurn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe('observeDispatchSettlements', () => {
  it('stops telling an observer once it is unsubscribed', async () => {
    const db = new OrchestrationDb(':memory:')
    const observer = vi.fn()
    const unsubscribe = observeDispatchSettlements(observer)

    notifyDispatchSettled(db.db, 'dispatch_first')
    await nextTurn()
    unsubscribe()
    notifyDispatchSettled(db.db, 'dispatch_second')
    await nextTurn()

    expect(observer).toHaveBeenCalledOnce()
    expect(observer).toHaveBeenCalledWith(db.db, 'dispatch_first')
    db.close()
  })

  it('lets an observer unsubscribe itself while it is being told of a settlement', async () => {
    const db = new OrchestrationDb(':memory:')
    const observer = vi.fn(() => {
      unsubscribe()
    })
    const unsubscribe = observeDispatchSettlements(observer)

    notifyDispatchSettled(db.db, 'dispatch_first')
    await nextTurn()
    notifyDispatchSettled(db.db, 'dispatch_second')
    await nextTurn()

    expect(observer).toHaveBeenCalledOnce()
    db.close()
  })
})
