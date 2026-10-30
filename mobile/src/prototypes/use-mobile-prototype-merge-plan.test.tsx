import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PrototypeMergePlan,
  PrototypeMergeState
} from '../../../src/shared/prototype-merge-plan'
import type { RpcClient } from '../transport/rpc-client'
import { useMobilePrototypeMergePlan } from './use-mobile-prototype-merge-plan'

const readPlan = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<string | null>>())
vi.mock('./mobile-prototype-merge-flow', () => ({ readMobilePrototypeMergePlanText: readPlan }))

// The hook only hands the client on to the (mocked) read.
const CLIENT: RpcClient = Object.create(null)
const SET = { sessionId: 'session-1', requestId: 'req-1' }
const PLAN_JSON = JSON.stringify({
  id: 'plan-1',
  from: ['A', 'C'],
  parts: [{ name: 'Heading', selector: 'main > h1', from: 'A' }]
})
const WAITING: PrototypeMergeState = {
  phase: 'waiting',
  letters: ['A', 'C'],
  planId: 'plan-1',
  baseline: null
}

function Watcher({
  merge,
  onPlan
}: {
  merge: PrototypeMergeState | null
  onPlan: (plan: PrototypeMergePlan, text: string) => void
}) {
  useMobilePrototypeMergePlan(CLIENT, SET, merge, onPlan)
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  readPlan.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('waiting for the merge plan', () => {
  it('reads the plan file every few seconds and hands over a valid plan', async () => {
    readPlan.mockResolvedValueOnce(null).mockResolvedValue(PLAN_JSON)
    const onPlan = vi.fn()
    act(() => {
      create(createElement(Watcher, { merge: WAITING, onPlan }))
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    expect(onPlan).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    expect(onPlan).toHaveBeenCalledTimes(1)
    expect(onPlan.mock.calls[0]?.[1]).toBe(PLAN_JSON)
  })

  it('ignores text that is not a plan', async () => {
    readPlan.mockResolvedValue('not json')
    const onPlan = vi.fn()
    act(() => {
      create(createElement(Watcher, { merge: WAITING, onPlan }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    expect(onPlan).not.toHaveBeenCalled()
  })

  it('does not hand over a plan left by an earlier merge on the same request', async () => {
    readPlan.mockResolvedValue(
      JSON.stringify({
        id: 'plan-0',
        from: ['A', 'C'],
        parts: [{ name: 'Heading', selector: 'main > h1', from: 'A' }]
      })
    )
    const onPlan = vi.fn()
    act(() => {
      create(createElement(Watcher, { merge: WAITING, onPlan }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000)
    })
    expect(readPlan).toHaveBeenCalledTimes(3)
    expect(onPlan).not.toHaveBeenCalled()
  })

  it('does not hand over a plan for other directions', async () => {
    readPlan.mockResolvedValue(
      JSON.stringify({
        id: 'plan-1',
        from: ['A', 'B'],
        parts: [{ name: 'Heading', selector: 'main > h1', from: 'A' }]
      })
    )
    const onPlan = vi.fn()
    act(() => {
      create(createElement(Watcher, { merge: WAITING, onPlan }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000)
    })
    expect(readPlan).toHaveBeenCalledTimes(2)
    expect(onPlan).not.toHaveBeenCalled()
  })

  it('takes a plan without an id only when it differs from the file read at the send', async () => {
    const before = JSON.stringify({
      from: ['A', 'C'],
      parts: [{ name: 'Heading', selector: 'main > h1', from: 'A' }]
    })
    const after = JSON.stringify({
      from: ['A', 'C'],
      parts: [{ name: 'Heading', selector: 'main > h1', from: 'C' }]
    })
    const onPlan = vi.fn()
    readPlan.mockResolvedValue(before)
    act(() => {
      create(createElement(Watcher, { merge: { ...WAITING, baseline: before }, onPlan }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000)
    })
    expect(readPlan).toHaveBeenCalledTimes(2)
    expect(onPlan).not.toHaveBeenCalled()

    readPlan.mockResolvedValue(after)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    expect(onPlan).toHaveBeenCalledTimes(1)
    expect(onPlan.mock.calls[0]?.[1]).toBe(after)
  })

  it('reads nothing when no merge waits, and stops once it unmounts', async () => {
    readPlan.mockResolvedValue(PLAN_JSON)
    const onPlan = vi.fn()
    const renderer = create(createElement(Watcher, { merge: null, onPlan }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(readPlan).not.toHaveBeenCalled()

    act(() => {
      renderer.update(createElement(Watcher, { merge: WAITING, onPlan }))
    })
    act(() => {
      renderer.unmount()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(readPlan).not.toHaveBeenCalled()
  })
})
