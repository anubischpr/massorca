import { describe, expect, it } from 'vitest'
import type { AgentChildRowModel } from '../../../src/shared/agent-child-row-model'
import { agentChildRowContextForSessionStream } from '../../../src/shared/agent-child-row-stream-context'
import type { AgentChildWorkView } from '../../../src/shared/agent-status-child-work-view'
import { mergeFinishedBackgroundRows, settledHistoryRows } from './mobile-finished-background-work'
import { MAX_FINISHED_BACKGROUND_ROWS } from './mobile-seen-background-work'

const NOW = 10_000_000
const context = agentChildRowContextForSessionStream(true, 0)

function view(id: string, overrides: Partial<AgentChildWorkView> = {}): AgentChildWorkView {
  return {
    id,
    providerId: `task-${id}`,
    kind: 'command',
    description: `build ${id}`,
    state: 'working',
    membership: 'live',
    firstObservedAt: NOW - 65_000,
    observedAt: NOW - 1_000,
    stoppable: true,
    invocation: { invocationId: `spawn-${id}`, generation: 1 },
    ...overrides
  }
}

function row(id: string, overrides: Partial<AgentChildRowModel> = {}): AgentChildRowModel {
  return {
    id,
    providerId: id,
    kind: 'command',
    displayState: 'idle',
    name: `build ${id}`,
    detail: null,
    firstObservedAt: 1_000,
    recencyAt: 1_000,
    canStop: false,
    settled: true,
    owned: [],
    ...overrides
  }
}

describe('settledHistoryRows', () => {
  it('reads no rows from a host that sends no command history', () => {
    expect(settledHistoryRows(undefined, context)).toEqual([])
    expect(settledHistoryRows([], context)).toEqual([])
  })

  it('keeps the settled commands and leaves running ones to the live roster', () => {
    const rows = settledHistoryRows(
      [view('old', { state: 'done', membership: 'settled', settledAt: NOW - 5_000 }), view('live')],
      context
    )
    expect(rows.map((item) => item.id)).toEqual(['old'])
    expect(rows[0]?.settled).toBe(true)
  })
})

describe('mergeFinishedBackgroundRows', () => {
  it('lists the rows this phone saw end first, then the history rows it did not see', () => {
    const merged = mergeFinishedBackgroundRows({
      seen: [row('seen-late')],
      history: [row('hist-old', { settledAt: 1_000 }), row('hist-new', { settledAt: 9_000 })],
      running: []
    })
    expect(merged.map((item) => item.id)).toEqual(['seen-late', 'hist-new', 'hist-old'])
  })

  it('never lists a row that is running now, nor the same row twice', () => {
    const merged = mergeFinishedBackgroundRows({
      seen: [row('a', { settledAt: 5 })],
      history: [row('a', { settledAt: 5 }), row('b', { settledAt: 4 })],
      running: [row('b', { settled: false })]
    })
    expect(merged.map((item) => item.id)).toEqual(['a'])
  })

  it('bounds the list like the seen list', () => {
    const history = Array.from({ length: MAX_FINISHED_BACKGROUND_ROWS + 5 }, (_, index) =>
      row(`h${index}`, { settledAt: index })
    )
    expect(mergeFinishedBackgroundRows({ seen: [], history, running: [] })).toHaveLength(
      MAX_FINISHED_BACKGROUND_ROWS
    )
  })
})
