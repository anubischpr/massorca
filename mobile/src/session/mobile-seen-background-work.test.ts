import { describe, expect, it } from 'vitest'
import type { AgentChildRowModel } from '../../../src/shared/agent-child-row-model'
import {
  emptySeenBackgroundWork,
  foldSeenBackgroundWork,
  MAX_FINISHED_BACKGROUND_ROWS
} from './mobile-seen-background-work'

function row(id: string, overrides: Partial<AgentChildRowModel> = {}): AgentChildRowModel {
  return {
    id,
    providerId: id,
    kind: 'agent',
    displayState: 'working',
    name: `agent ${id}`,
    detail: null,
    firstObservedAt: 1_000,
    recencyAt: 1_000,
    canStop: true,
    settled: false,
    owned: [],
    ...overrides
  }
}

function fold(
  previous: ReturnType<typeof emptySeenBackgroundWork>,
  rows: AgentChildRowModel[],
  options: { live?: boolean; hostNow?: number; scopeKey?: string } = {}
): ReturnType<typeof emptySeenBackgroundWork> {
  return foldSeenBackgroundWork(previous, {
    scopeKey: options.scopeKey ?? 'chat',
    rows,
    live: options.live ?? true,
    hostNow: options.hostNow ?? 9_000
  })
}

describe('foldSeenBackgroundWork', () => {
  it('moves a row that leaves a live roster to finished, stamped when it was seen to end', () => {
    const running = fold(emptySeenBackgroundWork('chat'), [row('a'), row('b')])
    expect(running.finished).toEqual([])

    const next = fold(running, [row('b')], { hostNow: 9_500 })

    expect(next.finished).toHaveLength(1)
    expect(next.finished[0]).toMatchObject({
      id: 'a',
      settled: true,
      settledAt: 9_500,
      canStop: false,
      // The lane cannot say how it ended, so it claims neither success nor failure.
      displayState: 'idle',
      detail: { kind: 'ended' }
    })
    expect([...next.running.keys()]).toEqual(['b'])
  })

  it('never finishes a row while the feed is not live', () => {
    const running = fold(emptySeenBackgroundWork('chat'), [row('a')])

    const lost = fold(running, [], { live: false })

    expect(lost).toBe(running)
    expect(lost.finished).toEqual([])
  })

  it('finishes a row that vanished during a lost feed once the feed is live again', () => {
    const running = fold(emptySeenBackgroundWork('chat'), [row('a')])
    const lost = fold(running, [], { live: false })

    const back = fold(lost, [], { live: true, hostNow: 9_800 })

    expect(back.finished.map((finished) => finished.id)).toEqual(['a'])
  })

  it('takes a row back out of finished when it runs again', () => {
    const running = fold(emptySeenBackgroundWork('chat'), [row('a')])
    const ended = fold(running, [])
    expect(ended.finished).toHaveLength(1)

    const resumed = fold(ended, [row('a')])

    expect(resumed.finished).toEqual([])
    expect([...resumed.running.keys()]).toEqual(['a'])
  })

  it('settles the work a finished row owned with it', () => {
    const owner = row('a', { owned: [row('shell', { kind: 'command' })] })
    const running = fold(emptySeenBackgroundWork('chat'), [owner])

    const next = fold(running, [], { hostNow: 9_100 })

    expect(next.finished[0]?.owned[0]).toMatchObject({ id: 'shell', settled: true, canStop: false })
  })

  it('lists a row that arrives already settled once, without running it', () => {
    const settled = row('old', { settled: true, settledAt: 5_000 })

    const first = fold(emptySeenBackgroundWork('chat'), [settled])
    const second = fold(first, [settled])

    expect(first.finished.map((finished) => finished.id)).toEqual(['old'])
    expect(first.running.size).toBe(0)
    expect(second).toBe(first)
  })

  it('starts over for another chat', () => {
    const running = fold(emptySeenBackgroundWork('chat'), [row('a')])
    const ended = fold(running, [])

    const other = fold(ended, [row('z')], { scopeKey: 'other-chat' })

    expect(other.scopeKey).toBe('other-chat')
    expect(other.finished).toEqual([])
    expect([...other.running.keys()]).toEqual(['z'])
  })

  it('is idempotent for one read, and returns the same object when nothing changed', () => {
    const rows = [row('a'), row('b')]
    const first = fold(emptySeenBackgroundWork('chat'), rows)

    expect(fold(first, rows)).toBe(first)

    const ended = fold(first, [rows[1]!])
    expect(fold(ended, [rows[1]!])).toBe(ended)
  })

  it('keeps the newest finished rows, newest first, up to the cap', () => {
    let state = fold(
      emptySeenBackgroundWork('chat'),
      Array.from({ length: MAX_FINISHED_BACKGROUND_ROWS + 5 }, (_, index) => row(`r${index}`))
    )
    state = fold(state, [])

    expect(state.finished).toHaveLength(MAX_FINISHED_BACKGROUND_ROWS)

    state = fold(state, [row('late')])
    state = fold(state, [], { hostNow: 9_900 })
    expect(state.finished[0]?.id).toBe('late')
    expect(state.finished).toHaveLength(MAX_FINISHED_BACKGROUND_ROWS)
  })
})
