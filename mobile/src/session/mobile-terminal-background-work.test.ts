import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../src/shared/agent-status-types'
import {
  readTerminalBackgroundWork,
  terminalTurnStartedAt
} from './mobile-terminal-background-work'

const NOW = 10_000_000

function status(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'working',
    prompt: 'ship it',
    updatedAt: NOW - 1_000,
    stateStartedAt: NOW - 60_000,
    paneKey: 'tab:leaf',
    stateHistory: [],
    agentType: 'claude',
    ...overrides
  }
}

const SUBAGENTS: AgentStatusEntry['subagents'] = [
  {
    id: 'a1',
    agentType: 'Explore',
    description: 'Map the repo',
    state: 'working',
    startedAt: NOW - 30_000
  },
  { id: 'a2', agentType: 'Plan', state: 'waiting', startedAt: NOW - 10_000 }
]

describe('readTerminalBackgroundWork', () => {
  it('lists the pane subagents as running rows with no Stop', () => {
    const read = readTerminalBackgroundWork(status({ subagents: SUBAGENTS }), {
      connected: true,
      now: NOW
    })

    expect(
      read.rows.map((row) => [row.id, row.name, row.displayState, row.firstObservedAt])
    ).toEqual([
      ['a1', 'Map the repo', 'working', NOW - 30_000],
      ['a2', 'Plan', 'waiting', NOW - 10_000]
    ])
    // The host stops no pane subagent, so no row may offer to.
    expect(read.rows.every((row) => !row.canStop && !row.settled)).toBe(true)
    expect(read.live).toBe(true)
    expect(read.unlistedWork).toBe(false)
  })

  it('reads every live row as unverifiable, and lists nothing as ended, once the host is not heard', () => {
    const read = readTerminalBackgroundWork(status({ subagents: SUBAGENTS }), {
      connected: false,
      now: NOW
    })

    expect(read.rows.map((row) => row.displayState)).toEqual(['unverifiable', 'unverifiable'])
    expect(read.live).toBe(false)
    expect(read.rowContext.transportObservation).toBe('unverifiable')
  })

  it('reads rows as unverifiable when the pane status went stale', () => {
    const read = readTerminalBackgroundWork(
      status({ subagents: SUBAGENTS, updatedAt: NOW - 31 * 60_000 }),
      { connected: true, now: NOW }
    )

    expect(read.rows.map((row) => row.displayState)).toEqual(['unverifiable', 'unverifiable'])
  })

  it("keeps the renderer's own lost-contact verdict on the rows", () => {
    const read = readTerminalBackgroundWork(
      status({ subagents: SUBAGENTS, subagentObservation: 'unverifiable' }),
      { connected: true, now: NOW }
    )

    expect(read.rows[0]?.displayState).toBe('unverifiable')
    expect(read.live).toBe(false)
  })

  it('reports unlisted work for a monitoring pane that lists no subagent', () => {
    const read = readTerminalBackgroundWork(status({ workingMode: 'monitoring' }), {
      connected: true,
      now: NOW
    })

    expect(read.rows).toEqual([])
    expect(read.unlistedWork).toBe(true)
  })

  it('reports nothing for a pane with no status, and holds the list open while disconnected', () => {
    expect(readTerminalBackgroundWork(null, { connected: true, now: NOW })).toMatchObject({
      rows: [],
      unlistedWork: false,
      turnStartedAt: null,
      live: true
    })
    expect(readTerminalBackgroundWork(undefined, { connected: false, now: NOW }).live).toBe(false)
  })
})

describe('terminalTurnStartedAt', () => {
  it('prefers the host turn start, then the main agent clock, then the row clock', () => {
    const base = status()
    expect(terminalTurnStartedAt({ ...base, turnStartedAt: 111 })).toBe(111)
    expect(
      terminalTurnStartedAt({ ...base, mainAgent: { state: 'working', stateStartedAt: 222 } })
    ).toBe(222)
    expect(terminalTurnStartedAt(base)).toBe(base.stateStartedAt)
  })

  it('has no clock once the main agent ended while its subagents run', () => {
    expect(
      terminalTurnStartedAt(
        status({ mainAgent: { state: 'done', outcome: 'success', stateStartedAt: 5 } })
      )
    ).toBeNull()
  })

  it('has no clock for a monitoring, done or absent row', () => {
    expect(terminalTurnStartedAt(status({ workingMode: 'monitoring' }))).toBeNull()
    expect(terminalTurnStartedAt(status({ state: 'done' }))).toBeNull()
    expect(terminalTurnStartedAt(null)).toBeNull()
  })
})
