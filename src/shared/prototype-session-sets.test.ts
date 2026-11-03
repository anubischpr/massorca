import { describe, expect, it } from 'vitest'
import type { PrototypeListedSet } from './rpc-contract/prototype-params'
import { prototypeSessionScopeKey, prototypeSetsOfSession } from './prototype-session-sets'

function set(
  requestId: string,
  sessionId: string,
  createdAt: string,
  originSessionId?: string
): PrototypeListedSet {
  return {
    requestId,
    sessionId,
    agent: 'claude',
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'Two directions',
    createdAt,
    count: 2,
    ...(originSessionId !== undefined ? { origin: { sessionId: originSessionId } } : {}),
    directions: []
  }
}

const sets = [
  set('own', 'task', '2026-11-03T01:00:00.000Z'),
  set('child-a', 'child-1', '2026-11-03T03:00:00.000Z'),
  set('delegated', 'child-2', '2026-11-03T02:00:00.000Z', 'task'),
  set('other', 'elsewhere', '2026-11-03T04:00:00.000Z')
]

describe('prototypeSetsOfSession', () => {
  it('lists the session own sets, its named children and sets that recorded it as origin, newest first', () => {
    expect(
      prototypeSetsOfSession(sets, { sessionId: 'task', childSessionIds: ['child-1'] }).map(
        (s) => s.requestId
      )
    ).toEqual(['child-a', 'delegated', 'own'])
  })

  it('finds delegated sets by origin when the caller knows no children', () => {
    expect(prototypeSetsOfSession(sets, { sessionId: 'task' }).map((s) => s.requestId)).toEqual([
      'delegated',
      'own'
    ])
  })

  it('lists nothing for a session without prototypes', () => {
    expect(prototypeSetsOfSession(sets, { sessionId: 'quiet' })).toEqual([])
  })

  it('does not reorder the listing it was given', () => {
    const listed = [...sets]
    prototypeSetsOfSession(listed, { sessionId: 'task', childSessionIds: ['child-1'] })
    expect(listed).toEqual(sets)
  })
})

describe('prototypeSessionScopeKey', () => {
  it('changes with the session and its children', () => {
    expect(prototypeSessionScopeKey(null)).toBe('')
    expect(prototypeSessionScopeKey({ sessionId: 'task' })).toBe('task')
    expect(prototypeSessionScopeKey({ sessionId: 'task', childSessionIds: ['a', 'b'] })).toBe(
      'task a b'
    )
  })
})
