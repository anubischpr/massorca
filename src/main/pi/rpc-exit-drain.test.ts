import { afterEach, describe, expect, it, vi } from 'vitest'
import { awaitTimelineDrain } from './rpc-exit-drain'

afterEach(() => vi.useRealTimers())

describe('awaitTimelineDrain', () => {
  it('resolves without a warning when the timeline drains in time', async () => {
    const onTimeout = vi.fn()
    await awaitTimelineDrain({ drained: async () => {} }, onTimeout)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('stops waiting at the bound and reports the timeout once when the timeline never drains', async () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()
    const settled = vi.fn()
    const waiting = awaitTimelineDrain(
      { drained: () => new Promise<void>(() => {}) },
      onTimeout,
      2_000
    )
    void waiting.then(settled)
    await vi.advanceTimersByTimeAsync(1_999)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await waiting
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })
})
