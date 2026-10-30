import { describe, expect, it } from 'vitest'
import {
  activePrototypeSets,
  archivedPrototypeSets,
  requestToOpenAfterArchiving
} from './prototype-archived-sets'
import type { PrototypeListedSet } from './rpc-contract/prototype-params'

function set(requestId: string, archived?: true): PrototypeListedSet {
  return {
    requestId,
    sessionId: 'session-1',
    agent: 'claude',
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'a page',
    createdAt: '2026-10-28T20:15:00.000Z',
    count: 1,
    directions: [],
    ...(archived === undefined ? {} : { archived })
  }
}

describe('prototype archived sets', () => {
  it('splits the listing into the main list and the Archived group, keeping each order', () => {
    const sets = [set('r3'), set('r2', true), set('r1'), set('r0', true)]
    expect(activePrototypeSets(sets).map((entry) => entry.requestId)).toEqual(['r3', 'r1'])
    expect(archivedPrototypeSets(sets).map((entry) => entry.requestId)).toEqual(['r2', 'r0'])
  })

  it('falls back to the next row, then the previous one, then to none', () => {
    const rows = (...ids: string[]) => ids.map((id) => ({ set: set(id) }))
    expect(requestToOpenAfterArchiving(rows('a', 'b', 'c'), 'b')).toBe('c')
    expect(requestToOpenAfterArchiving(rows('a', 'b', 'c'), 'c')).toBe('b')
    expect(requestToOpenAfterArchiving(rows('a'), 'a')).toBeNull()
    expect(requestToOpenAfterArchiving(rows('a', 'b'), 'missing')).toBe('a')
  })
})
