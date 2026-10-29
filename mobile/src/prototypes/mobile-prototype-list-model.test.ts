import { describe, expect, it } from 'vitest'
import {
  MOBILE_PROTOTYPE_FILTERS,
  buildMobilePrototypeRows,
  mobilePrototypeFilterLabel,
  mobilePrototypeMenuCount,
  mobilePrototypeSetsInScope,
  mobilePrototypeStatusLabel
} from './mobile-prototype-list-model'
import { FIXTURE_NOW, listedSet, singleDirectionSet } from './mobile-prototype-sets.test-fixture'

const THIS_CHAT = listedSet({ requestId: 'req-this', sessionId: 'session-this' })
const OTHER_CHAT = listedSet({
  requestId: 'req-other',
  sessionId: 'session-other',
  agent: 'claude',
  chatTitle: null,
  originalPrompt: 'A pricing page with four plans'
})
const SINGLE = singleDirectionSet({ sessionId: 'session-other', agent: 'antigravity' })

function rows(
  scope: 'chat' | 'all',
  filter: Parameters<typeof buildMobilePrototypeRows>[0]['filter'] = 'all'
) {
  return buildMobilePrototypeRows({
    sets: [THIS_CHAT, OTHER_CHAT, SINGLE],
    scope,
    sessionId: 'session-this',
    filter,
    activeLetterOf: (requestId) => (requestId === 'req-this' ? 'B' : undefined),
    nowMs: FIXTURE_NOW
  })
}

describe('mobile prototype list rows', () => {
  it('shows every agent under "All agents", in the order the host lists them', () => {
    expect(rows('all').map((row) => row.set.requestId)).toEqual([
      'req-this',
      'req-other',
      SINGLE.requestId
    ])
  })

  it('shows only the chat the list was opened from under "This chat"', () => {
    expect(rows('chat').map((row) => row.set.requestId)).toEqual(['req-this'])
  })

  it('shows every set when there is no chat to name', () => {
    expect(mobilePrototypeSetsInScope([THIS_CHAT, OTHER_CHAT], 'chat', null)).toHaveLength(2)
  })

  it('narrows by agent, Stitch being Antigravity', () => {
    expect(rows('all', 'antigravity').map((row) => row.set.requestId)).toEqual([SINGLE.requestId])
    expect(rows('all', 'codex').map((row) => row.set.requestId)).toEqual(['req-this'])
  })

  it('reads the title, age and the iterated direction like the desktop list', () => {
    const [first, second] = rows('all')
    expect(first?.title).toBe('checkout-flow')
    expect(first?.age).toBe('1m')
    expect(first?.mono).toBe('CX')
    expect(first && mobilePrototypeStatusLabel(first.status)).toBe('3 directions · iterating B')
    expect(second?.title).toBe('A pricing page with four plans')
  })

  it('names a one-direction set as one screen', () => {
    const single = rows('all').find((row) => row.set.requestId === SINGLE.requestId)
    expect(single && mobilePrototypeStatusLabel(single.status)).toBe('1 screen')
  })
})

describe('mobile prototype list status and age', () => {
  it('keeps a shortfall or an empty request out of the one-screen read', () => {
    const shortfall = buildMobilePrototypeRows({
      sets: [listedSet({ count: 3, directions: listedSet().directions.slice(0, 1) })],
      scope: 'all',
      sessionId: null,
      filter: 'all',
      activeLetterOf: () => undefined,
      nowMs: FIXTURE_NOW
    })
    expect(shortfall[0] && mobilePrototypeStatusLabel(shortfall[0].status)).toBe(
      '1 directions · iterating A'
    )
    const empty = buildMobilePrototypeRows({
      sets: [listedSet({ count: 1, directions: [] })],
      scope: 'all',
      sessionId: null,
      filter: 'all',
      activeLetterOf: () => undefined,
      nowMs: FIXTURE_NOW
    })
    expect(empty[0]?.status).toEqual({ kind: 'directions', count: 0, iterating: '' })
  })

  it('shows no age for a set with no valid time', () => {
    const [row] = buildMobilePrototypeRows({
      sets: [
        listedSet({
          createdAt: 'not a date',
          directions: [
            { letter: 'A', versions: [{ version: 1, fileName: 'A.html', mtime: Number.NaN }] }
          ]
        })
      ],
      scope: 'all',
      sessionId: null,
      filter: 'all',
      activeLetterOf: () => undefined,
      nowMs: FIXTURE_NOW
    })
    expect(row?.age).toBeNull()
  })
})

describe('filter chips', () => {
  it('are the agent filters of the approved desktop list', () => {
    expect(MOBILE_PROTOTYPE_FILTERS.map(mobilePrototypeFilterLabel)).toEqual([
      'All',
      'Claude',
      'Codex',
      'Stitch',
      'Gentle Shell'
    ])
  })
})

describe('mobilePrototypeMenuCount', () => {
  it('counts the sets of this chat', () => {
    expect(mobilePrototypeMenuCount([THIS_CHAT, OTHER_CHAT, SINGLE], 'session-this')).toBe(1)
    expect(mobilePrototypeMenuCount([THIS_CHAT, OTHER_CHAT, SINGLE], 'session-other')).toBe(2)
  })

  it('counts nothing for a chat without a session', () => {
    expect(mobilePrototypeMenuCount([THIS_CHAT], null)).toBe(0)
  })
})
