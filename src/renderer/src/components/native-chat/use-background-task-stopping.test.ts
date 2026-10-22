// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBackgroundTaskStopping } from './use-background-task-stopping'

afterEach(cleanup)

function pendingAnswer() {
  let answer: () => void = () => undefined
  const settled = new Promise<unknown>((resolve) => {
    answer = () => resolve(undefined)
  })
  return { settled, answer }
}

describe('useBackgroundTaskStopping', () => {
  it('keeps a task stopping until the host answers, then releases it', async () => {
    const pending = pendingAnswer()
    const stopBackgroundTask = vi.fn(() => pending.settled)
    const { result } = renderHook(() =>
      useBackgroundTaskStopping({ sessionId: 'session-1', stopBackgroundTask })
    )

    act(() => result.current.onStop('task-1'))
    expect(stopBackgroundTask).toHaveBeenCalledWith('task-1')
    expect([...result.current.stoppingTaskIds]).toEqual(['task-1'])
    expect(result.current.stoppingAll).toBe(false)

    await act(async () => pending.answer())
    expect(result.current.stoppingTaskIds.size).toBe(0)
  })

  it('reports an untargeted stop as stopping everything until it settles', async () => {
    const pending = pendingAnswer()
    const { result } = renderHook(() =>
      useBackgroundTaskStopping({
        sessionId: 'session-1',
        stopBackgroundTask: () => pending.settled
      })
    )

    act(() => result.current.onStop())
    expect(result.current.stoppingAll).toBe(true)

    await act(async () => pending.answer())
    expect(result.current.stoppingAll).toBe(false)
  })

  it('does not carry one session stopping into another', () => {
    const pending = pendingAnswer()
    const { result, rerender } = renderHook(
      ({ sessionId }: { sessionId: string }) =>
        useBackgroundTaskStopping({ sessionId, stopBackgroundTask: () => pending.settled }),
      { initialProps: { sessionId: 'session-1' } }
    )

    act(() => result.current.onStop('task-1'))
    rerender({ sessionId: 'session-2' })
    expect(result.current.stoppingTaskIds.size).toBe(0)
  })
})
