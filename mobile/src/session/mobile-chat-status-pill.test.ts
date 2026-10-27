import { describe, expect, it } from 'vitest'
import {
  formatMobileStatusPillElapsed,
  mobileChatStatusPill,
  mobileStatusPillAccessibilityLabel,
  mobileStatusPillCounts
} from './mobile-chat-status-pill'

describe('formatMobileStatusPillElapsed', () => {
  it('reads minutes and seconds under an hour', () => {
    expect(formatMobileStatusPillElapsed(4 * 60_000 + 12_000)).toBe('4:12')
    expect(formatMobileStatusPillElapsed(9_000)).toBe('0:09')
  })

  it('adds hours from one hour on, and reads clock skew as zero', () => {
    expect(formatMobileStatusPillElapsed(3_600_000 + 5 * 60_000 + 7_000)).toBe('1:05:07')
    expect(formatMobileStatusPillElapsed(-4_000)).toBe('0:00')
  })
})

describe('mobileStatusPillCounts', () => {
  it('counts running terminals (commands and monitors) and agents, not done work', () => {
    const counts = mobileStatusPillCounts([
      { kind: 'command', tasks: [{ state: 'working' }, { state: 'done' }] },
      { kind: 'monitor', tasks: [{ state: 'monitoring' }] },
      { kind: 'agent', tasks: [{ state: 'working' }, { state: 'waiting' }, { state: 'done' }] }
    ])
    expect(counts).toEqual({ terminals: 2, agents: 2 })
  })

  it('leaves workflows and unknown kinds out of the pill', () => {
    expect(
      mobileStatusPillCounts([
        { kind: 'workflow', tasks: [{ state: 'working' }] },
        { kind: 'unknown', tasks: [{ state: 'working' }] }
      ])
    ).toEqual({ terminals: 0, agents: 0 })
  })
})

describe('mobileChatStatusPill', () => {
  const counts = { terminals: 1, agents: 0 }

  it('shows the elapsed clock while a turn runs on a lane that has a start', () => {
    const pill = mobileChatStatusPill({
      working: true,
      startedAt: 1_000,
      now: 1_000 + 4 * 60_000 + 12_000,
      counts
    })
    expect(pill).toMatchObject({ visible: true, label: 'Working', elapsed: '4:12', terminals: 1 })
  })

  it('shows no time on a lane with no start, and hides zero counts', () => {
    const pill = mobileChatStatusPill({
      working: true,
      startedAt: null,
      now: 99_000,
      counts: { terminals: 0, agents: 0 }
    })
    expect(pill).toEqual({
      visible: true,
      label: 'Working',
      elapsed: null,
      terminals: null,
      agents: null
    })
  })

  it('states no live work once the roster stream is lost, but keeps the sheet reachable', () => {
    expect(
      mobileChatStatusPill({
        working: true,
        startedAt: 1_000,
        now: 9_000,
        live: false,
        counts: { terminals: 1, agents: 2 }
      })
    ).toEqual({
      visible: true,
      label: 'Status unavailable',
      elapsed: null,
      terminals: null,
      agents: null
    })
  })

  it('stays hidden with no running turn and no running work', () => {
    expect(
      mobileChatStatusPill({
        working: false,
        startedAt: null,
        now: 0,
        counts: { terminals: 0, agents: 0 }
      }).visible
    ).toBe(false)
  })

  it('shows background work after the turn has ended, without a clock', () => {
    const pill = mobileChatStatusPill({
      working: false,
      startedAt: 1_000,
      now: 9_000,
      counts: { terminals: 0, agents: 2 }
    })
    expect(pill).toMatchObject({ visible: true, elapsed: null, terminals: null, agents: 2 })
  })
})

describe('mobileStatusPillAccessibilityLabel', () => {
  it('names the same things the pill shows, with singular and plural counts', () => {
    expect(
      mobileStatusPillAccessibilityLabel({
        visible: true,
        label: 'Working',
        elapsed: '4:12',
        terminals: 1,
        agents: 3
      })
    ).toBe('Show background work, Working, 4:12, 1 terminal, 3 agents')
  })

  it('leaves out what the pill does not show', () => {
    expect(
      mobileStatusPillAccessibilityLabel({
        visible: true,
        label: 'Working',
        elapsed: null,
        terminals: null,
        agents: null
      })
    ).toBe('Show background work, Working')
  })
})
