import { describe, expect, it } from 'vitest'
import type { DelegatedChild } from '../../../src/shared/delegated-children'
import { MAX_FINISHED_BACKGROUND_ROWS } from './mobile-seen-background-work'
import {
  delegatedChildClockText,
  finishedDelegatedChildren,
  runningDelegatedChildren,
  taskRowsWithinFinishedBound
} from './mobile-delegated-child-rows'

function child(overrides: Partial<DelegatedChild> & { requestId: string }): DelegatedChild {
  return {
    title: overrides.requestId,
    status: 'working',
    agent: 'codex',
    model: null,
    effort: null,
    automatic: false,
    childSessionId: `child-${overrides.requestId}`,
    startedAt: 1_000,
    resultSummary: null,
    durationMs: null,
    reason: null,
    ...overrides
  }
}

describe('delegated child rows', () => {
  it('splits running children from settled ones, keeping each in its order', () => {
    const children = [
      child({ requestId: 'a', status: 'succeeded' }),
      child({ requestId: 'b' }),
      child({ requestId: 'c', status: 'not-started', startedAt: null })
    ]

    expect(runningDelegatedChildren(children).map((entry) => entry.requestId)).toEqual(['b'])
    expect(finishedDelegatedChildren(children).map((entry) => entry.requestId)).toEqual(['a', 'c'])
  })

  it('lists finished children newest started first, and bounds them like the finished rows', () => {
    const children = Array.from({ length: MAX_FINISHED_BACKGROUND_ROWS + 5 }, (_, index) =>
      child({ requestId: `r${index}`, status: 'failed', startedAt: index * 1_000 })
    )

    const finished = finishedDelegatedChildren(children)

    expect(finished).toHaveLength(MAX_FINISHED_BACKGROUND_ROWS)
    expect(finished[0]?.requestId).toBe(`r${MAX_FINISHED_BACKGROUND_ROWS + 4}`)
  })

  it('gives children their share of the Finished bound before the task rows', () => {
    const tasks = Array.from({ length: MAX_FINISHED_BACKGROUND_ROWS }, (_, index) => index)

    expect(taskRowsWithinFinishedBound(tasks, 0)).toHaveLength(MAX_FINISHED_BACKGROUND_ROWS)
    expect(taskRowsWithinFinishedBound(tasks, 5)).toHaveLength(MAX_FINISHED_BACKGROUND_ROWS - 5)
    expect(taskRowsWithinFinishedBound(tasks, MAX_FINISHED_BACKGROUND_ROWS + 1)).toHaveLength(0)
  })

  it('reads a running child on the host clock, and a settled one from its reported duration', () => {
    expect(delegatedChildClockText(child({ requestId: 'a', startedAt: 0 }), 4 * 60_000)).toBe(
      '4 min'
    )
    expect(
      delegatedChildClockText(
        child({ requestId: 'b', status: 'succeeded', durationMs: 12 * 60_000 }),
        99 * 60_000
      )
    ).toBe('12 min')
  })

  it('reads no clock for a child whose start was never observed', () => {
    expect(delegatedChildClockText(child({ requestId: 'a', startedAt: null }), 60_000)).toBeNull()
  })
})
