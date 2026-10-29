import { describe, expect, it } from 'vitest'
import type { DelegatedChild } from '../../../../shared/delegated-children'
import { delegatedChildStatusText } from './delegated-child-copy'

const NOW = 10_000_000

function child(changes: Partial<DelegatedChild>): DelegatedChild {
  return {
    requestId: 'req-1',
    title: 'Explore',
    status: 'working',
    agent: 'codex',
    model: null,
    effort: null,
    automatic: false,
    childSessionId: 'child-1',
    startedAt: NOW - 4 * 60_000,
    resultSummary: null,
    durationMs: null,
    reason: null,
    ...changes
  }
}

describe('delegatedChildStatusText', () => {
  it('reads a working child as its agent, then its status and how long it has run', () => {
    expect(delegatedChildStatusText(child({}), NOW)).toBe('Codex · working · 4 min')
  })

  it('leaves out the clock of a working child with no start time', () => {
    expect(delegatedChildStatusText(child({ startedAt: null }), NOW)).toBe('Codex · working')
  })

  it('reads a finished child from its reported duration', () => {
    expect(
      delegatedChildStatusText(child({ status: 'succeeded', durationMs: 120 * 60_000 }), NOW)
    ).toBe('Codex · finished · 2 h')
  })

  it('reads a failed child with a sub-minute duration as under a minute', () => {
    expect(delegatedChildStatusText(child({ status: 'failed', durationMs: 30_000 }), NOW)).toBe(
      'Codex · failed · under 1 min'
    )
  })

  it('reads a child that never started with no agent and no clock', () => {
    expect(
      delegatedChildStatusText(
        child({ status: 'not-started', agent: null, startedAt: null, childSessionId: null }),
        NOW
      )
    ).toBe('did not start')
  })

  it('omits the clock of a finished child that reported no duration', () => {
    expect(delegatedChildStatusText(child({ status: 'succeeded', durationMs: null }), NOW)).toBe(
      'Codex · finished'
    )
  })
})
