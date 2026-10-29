import { describe, expect, it } from 'vitest'
import type { PrototypeListedSet } from './rpc-contract/prototype-params'
import {
  buildPrototypeListRows,
  latestVersionOf,
  prototypeAge,
  prototypeMatchesFilter,
  prototypeStatus,
  prototypeTitle
} from './prototype-list-model'

const NOW = Date.parse('2026-10-29T12:00:00.000Z')

function set(overrides: Partial<PrototypeListedSet> = {}): PrototypeListedSet {
  return {
    requestId: '20261029-100000-000001',
    sessionId: 'session-1',
    agent: 'codex',
    worktreeId: 'wt-1',
    chatTitle: 'checkout-flow',
    originalPrompt: 'Design a checkout flow',
    createdAt: '2026-10-29T10:00:00.000Z',
    count: 2,
    directions: [
      {
        letter: 'A',
        versions: [{ version: 1, fileName: 'prototypes/r/A.html', mtime: NOW - 4 * 60_000 }]
      },
      {
        letter: 'B',
        versions: [{ version: 1, fileName: 'prototypes/r/B.html', mtime: NOW - 4 * 60_000 }]
      }
    ],
    ...overrides
  }
}

describe('prototypeTitle', () => {
  it('uses the chat title when the chat has one', () => {
    expect(prototypeTitle(set())).toBe('checkout-flow')
  })

  it('falls back to the first six words of the prompt', () => {
    const title = prototypeTitle(
      set({ chatTitle: null, originalPrompt: 'one two three four five six seven eight' })
    )
    expect(title).toBe('one two three four five six')
  })

  it('treats a blank chat title as missing', () => {
    expect(prototypeTitle(set({ chatTitle: '   ', originalPrompt: 'Pricing page' }))).toBe(
      'Pricing page'
    )
  })
})

describe('prototypeStatus', () => {
  it('shows a single direction as one screen', () => {
    const single = set({ directions: [set().directions[0]!] })
    expect(prototypeStatus(single, 'A')).toEqual({ kind: 'single' })
  })

  it('shows the direction count and the iterated letter', () => {
    expect(prototypeStatus(set(), 'B')).toEqual({ kind: 'directions', count: 2, iterating: 'B' })
  })

  it('defaults the iterated letter to the first direction', () => {
    expect(prototypeStatus(set(), undefined)).toEqual({
      kind: 'directions',
      count: 2,
      iterating: 'A'
    })
  })
})

describe('prototypeAge', () => {
  it('reads the last write of any version', () => {
    expect(prototypeAge(set(), NOW)).toBe('4m')
  })

  it('uses hours then days', () => {
    const hourOld = set({
      directions: [
        { letter: 'A', versions: [{ version: 1, fileName: 'a', mtime: NOW - 61 * 60_000 }] }
      ]
    })
    expect(prototypeAge(hourOld, NOW)).toBe('1h')
    expect(prototypeAge(set({ createdAt: '2026-10-27T12:00:00.000Z', directions: [] }), NOW)).toBe(
      '2d'
    )
  })

  it('never shows a negative age for a write in the future', () => {
    expect(prototypeAge(set(), NOW - 1_000_000)).toBe('1m')
  })
})

describe('prototypeMatchesFilter', () => {
  it('matches everything under all, and one agent otherwise', () => {
    expect(prototypeMatchesFilter('all', 'other')).toBe(true)
    expect(prototypeMatchesFilter('codex', 'codex')).toBe(true)
    expect(prototypeMatchesFilter('codex', 'claude')).toBe(false)
    expect(prototypeMatchesFilter('antigravity', 'antigravity')).toBe(true)
    expect(prototypeMatchesFilter('gentle-shell', 'antigravity')).toBe(false)
  })
})

describe('buildPrototypeListRows', () => {
  it('keeps the host order and filters by agent', () => {
    const sets = [
      set({ requestId: 'r-claude', agent: 'claude', chatTitle: 'pricing' }),
      set({ requestId: 'r-codex', agent: 'codex' })
    ]
    const rows = buildPrototypeListRows({
      sets,
      filter: 'codex',
      activeLetterOf: () => undefined,
      nowMs: NOW
    })
    expect(rows.map((row) => row.set.requestId)).toEqual(['r-codex'])
    expect(rows[0]).toMatchObject({ title: 'checkout-flow', mono: 'CX', age: '4m' })
  })

  it('passes each set its iterated letter', () => {
    const rows = buildPrototypeListRows({
      sets: [set({ requestId: 'r-1' })],
      filter: 'all',
      activeLetterOf: (requestId) => (requestId === 'r-1' ? 'B' : undefined),
      nowMs: NOW
    })
    expect(rows[0]?.status).toEqual({ kind: 'directions', count: 2, iterating: 'B' })
  })
})

describe('latestVersionOf', () => {
  it('returns the highest version of a direction', () => {
    const direction = {
      letter: 'B',
      versions: [
        { version: 2, fileName: 'B-v2.html', mtime: 2 },
        { version: 1, fileName: 'B.html', mtime: 1 }
      ]
    }
    expect(latestVersionOf(direction)).toEqual({ version: 2, fileName: 'B-v2.html' })
    expect(latestVersionOf(undefined)).toBeNull()
  })
})
