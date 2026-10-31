import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChildBringBackController } from './child-bring-back-controller'

const READY = {
  kind: 'ready',
  commits: 1,
  files: 1,
  into: 'main',
  parentAhead: 0,
  childUncommitted: 0,
  childWorktreeRemoved: false,
  predictedConflicts: null,
  block: null,
  parentUncommitted: 0
}

describe('ChildBringBackController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('recovers from a first read that fails on a cold host', async () => {
    const call = vi.fn().mockRejectedValueOnce(new Error('cold')).mockResolvedValue(READY)
    const controller = new ChildBringBackController('r', call)
    controller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(controller.getSnapshot().status.kind).toBe('unavailable')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(controller.getSnapshot().status.kind).toBe('ready')
  })

  it('stops asking an older host that rejects every read', async () => {
    const call = vi.fn().mockRejectedValue(new Error('method not found'))
    const controller = new ChildBringBackController('r', call)
    controller.start()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(call).toHaveBeenCalledTimes(3)
    expect(controller.getSnapshot().status.kind).toBe('unavailable')
  })

  it('polls a blocked state until it clears, then stops', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ ...READY, block: 'parent-working' })
      .mockResolvedValue(READY)
    const controller = new ChildBringBackController('r', call)
    controller.start()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(controller.getSnapshot().status).toEqual(READY)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('shows a failed merge and rereads the state', async () => {
    const call = vi.fn(async (method: string) => {
      if (method === 'delegation.bringBack') {
        throw new Error('Committer identity unknown')
      }
      return READY
    })
    const controller = new ChildBringBackController('r', call)
    controller.start()
    await vi.advanceTimersByTimeAsync(0)
    controller.bringBack()
    expect(controller.getSnapshot().busy).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(controller.getSnapshot()).toMatchObject({
      busy: false,
      error: 'Committer identity unknown'
    })
  })

  it('stops reading once stopped', async () => {
    const call = vi.fn().mockResolvedValue({ ...READY, block: 'parent-working' })
    const controller = new ChildBringBackController('r', call)
    const stop = controller.start()
    await vi.advanceTimersByTimeAsync(0)
    stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(call).toHaveBeenCalledTimes(1)
  })
})
