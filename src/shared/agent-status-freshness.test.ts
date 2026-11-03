import { describe, expect, it } from 'vitest'
import {
  isFreshNonDoneAgentStatus,
  isFreshOrAwaitingNonDoneAgentStatus
} from './agent-status-freshness'

const NOW = 1_000_000_000_000
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

function row(
  state: 'working' | 'blocked' | 'waiting' | 'done',
  overrides: { updatedAt?: number; restoredUnconfirmed?: true } = {}
) {
  return { state, updatedAt: NOW - TWO_HOURS_MS, ...overrides }
}

describe('isFreshOrAwaitingNonDoneAgentStatus', () => {
  it('counts a blocked or waiting row as fresh however long ago its evidence was reported', () => {
    expect(isFreshOrAwaitingNonDoneAgentStatus(row('blocked'), NOW)).toBe(true)
    expect(isFreshOrAwaitingNonDoneAgentStatus(row('waiting'), NOW)).toBe(true)
  })

  it('still drops a working row older than the freshness window, and keeps a recent one', () => {
    expect(isFreshOrAwaitingNonDoneAgentStatus(row('working'), NOW)).toBe(false)
    expect(isFreshOrAwaitingNonDoneAgentStatus(row('working', { updatedAt: NOW }), NOW)).toBe(true)
  })

  it('keeps dropping an unconfirmed restored row and a done row', () => {
    expect(
      isFreshOrAwaitingNonDoneAgentStatus(row('blocked', { restoredUnconfirmed: true }), NOW)
    ).toBe(false)
    expect(isFreshOrAwaitingNonDoneAgentStatus(row('done', { updatedAt: NOW }), NOW)).toBe(false)
  })

  it('leaves control-flow readers on the window: a blocked row past it is not fresh for them', () => {
    expect(isFreshNonDoneAgentStatus(row('blocked'), NOW)).toBe(false)
    expect(isFreshNonDoneAgentStatus(row('blocked', { updatedAt: NOW }), NOW)).toBe(true)
  })
})
