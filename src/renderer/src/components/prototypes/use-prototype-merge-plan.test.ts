// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrototypeMergeState } from '../../../../shared/prototype-merge-plan'
import { readPrototypeSetFileOnHost } from '../../runtime/runtime-prototype-client'
import { usePrototypeMergePlan } from './use-prototype-merge-plan'

// The host read is answered per test, so the real hook decides which plan text reaches the caller.
vi.mock('../../runtime/runtime-prototype-client', () => ({
  readPrototypeSetFileOnHost: vi.fn()
}))
vi.mock('./prototype-host-targets', () => ({
  prototypeTargetForSession: () => 'host'
}))

const readFile = vi.mocked(readPrototypeSetFileOnHost)
const SET = { sessionId: 'session-1', requestId: 'req-1' }
const HEADING = [{ name: 'Heading', selector: 'main > h1', from: 'A' }]
const WAITING: PrototypeMergeState = {
  phase: 'waiting',
  letters: ['A', 'C'],
  planId: 'plan-1',
  baseline: null
}

function answerRead(text: string): void {
  readFile.mockResolvedValue({ ok: true, html: text })
}

async function pollTimes(count: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_000 * count)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  readFile.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('waiting for the merge plan', () => {
  it('hands over the plan that answers the merge being awaited', async () => {
    const matching = JSON.stringify({ id: 'plan-1', from: ['A', 'C'], parts: HEADING })
    answerRead(matching)
    const onPlan = vi.fn()
    renderHook(() => usePrototypeMergePlan(SET, WAITING, onPlan))
    await pollTimes(1)
    expect(onPlan).toHaveBeenCalledTimes(1)
    expect(onPlan.mock.calls[0]?.[1]).toBe(matching)
  })

  it('does not hand over a plan left by an earlier merge on the same request', async () => {
    answerRead(JSON.stringify({ id: 'plan-0', from: ['A', 'C'], parts: HEADING }))
    const onPlan = vi.fn()
    renderHook(() => usePrototypeMergePlan(SET, WAITING, onPlan))
    await pollTimes(3)
    expect(readFile).toHaveBeenCalledTimes(3)
    expect(onPlan).not.toHaveBeenCalled()
  })

  it('does not hand over a plan for other directions', async () => {
    answerRead(JSON.stringify({ id: 'plan-1', from: ['A', 'B'], parts: HEADING }))
    const onPlan = vi.fn()
    renderHook(() => usePrototypeMergePlan(SET, WAITING, onPlan))
    await pollTimes(2)
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(onPlan).not.toHaveBeenCalled()
  })

  it('takes a plan without an id only when it differs from the file read at the send', async () => {
    const before = JSON.stringify({ from: ['A', 'C'], parts: HEADING })
    const after = JSON.stringify({
      from: ['A', 'C'],
      parts: [{ name: 'Heading', selector: 'main > h1', from: 'C' }]
    })
    const waiting: PrototypeMergeState = { ...WAITING, baseline: before }
    answerRead(before)
    const onPlan = vi.fn()
    renderHook(() => usePrototypeMergePlan(SET, waiting, onPlan))
    await pollTimes(2)
    expect(readFile).toHaveBeenCalledTimes(2)
    expect(onPlan).not.toHaveBeenCalled()

    answerRead(after)
    await pollTimes(1)
    expect(onPlan).toHaveBeenCalledTimes(1)
    expect(onPlan.mock.calls[0]?.[1]).toBe(after)
  })
})
