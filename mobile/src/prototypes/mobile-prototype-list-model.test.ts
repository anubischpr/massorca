import { describe, expect, it } from 'vitest'
import {
  MOBILE_PROTOTYPE_FILTERS,
  buildMobilePrototypeArchivedRows,
  buildMobilePrototypeGroups,
  buildMobilePrototypeRows,
  mobilePrototypeFilterLabel,
  mobilePrototypeMenuCount,
  mobilePrototypeRowStatusLine,
  mobilePrototypeSetsInScope,
  mobilePrototypeStatusLabel,
  mobilePrototypeSystemLine
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

const NEXUS_SYSTEM = {
  projectKey: '/work/nexuscare',
  projectName: 'nexuscare',
  status: 'detected' as const,
  version: 2,
  tokenCount: 24,
  swatches: ['#1d4ed8', '#e5e5e5', '#737373', '#16a34a']
}
const LANDING_SYSTEM = {
  projectKey: '/work/landing-site',
  projectName: 'landing-site',
  status: 'proposed' as const,
  version: 1,
  tokenCount: 12,
  swatches: []
}

function groups(
  overrides: Partial<Parameters<typeof buildMobilePrototypeGroups>[0]> = {}
): ReturnType<typeof buildMobilePrototypeGroups> {
  return buildMobilePrototypeGroups({
    sets: [
      listedSet({
        requestId: 'req-this',
        sessionId: 'session-this',
        projectKey: '/work/nexuscare',
        projectName: 'nexuscare',
        builtOn: 2
      }),
      listedSet({
        requestId: 'req-other',
        sessionId: 'session-other',
        projectKey: '/work/checkout',
        projectName: 'checkout'
      })
    ],
    designSystems: [NEXUS_SYSTEM, LANDING_SYSTEM],
    scope: 'all',
    sessionId: 'session-this',
    filter: 'all',
    activeLetterOf: () => undefined,
    nowMs: FIXTURE_NOW,
    ...overrides
  })
}

describe('mobile prototype list groups', () => {
  it('groups the rows by project with its design system pinned, then a system with no set', () => {
    expect(
      groups().map((group) => [group.projectName, group.system?.status, group.rows.length])
    ).toEqual([
      ['nexuscare', 'detected', 1],
      ['checkout', undefined, 1],
      ['landing-site', 'proposed', 0]
    ])
  })

  it('keeps only the projects of this chat under "This chat"', () => {
    expect(groups({ scope: 'chat' }).map((group) => group.projectName)).toEqual(['nexuscare'])
  })

  it('keeps a project whose proposal waits in this chat', () => {
    const pending = {
      ...LANDING_SYSTEM,
      pendingRequest: { requestId: 'req-p', sessionId: 'session-this', agent: 'codex' as const }
    }
    expect(
      groups({ scope: 'chat', designSystems: [NEXUS_SYSTEM, pending] }).map(
        (group) => group.projectName
      )
    ).toEqual(['nexuscare', 'landing-site'])
  })

  it('keeps a design system row when the agent filter hides every set of its project', () => {
    const [group] = groups({ filter: 'claude' })
    expect(group?.system?.projectKey).toBe('/work/nexuscare')
    expect(group?.rows).toEqual([])
  })
})

describe('mobile prototype row and system labels', () => {
  it('appends the version a set was built on to its status line', () => {
    const [group] = groups()
    const [row] = group?.rows ?? []
    expect(row && mobilePrototypeRowStatusLine(row)).toBe(
      '3 directions · iterating A · built on v2'
    )
  })

  it('adds no suffix when the set recorded no version', () => {
    const row = groups().find((group) => group.projectName === 'checkout')?.rows[0]
    expect(row && mobilePrototypeRowStatusLine(row)).toBe('3 directions · iterating A')
  })

  it('reads a detected system as its version and token count, a proposed one as needing review', () => {
    expect(mobilePrototypeSystemLine(NEXUS_SYSTEM)).toBe('Detected · v2 · 24 tokens')
    expect(mobilePrototypeSystemLine(LANDING_SYSTEM)).toBe('Proposed · needs review')
  })
})

describe('archived sets in the mobile list', () => {
  const ARCHIVED = listedSet({
    requestId: 'req-archived',
    sessionId: 'session-this',
    archived: true,
    projectKey: 'nexus',
    projectName: 'nexuscare'
  })
  const input = {
    sets: [THIS_CHAT, OTHER_CHAT, ARCHIVED],
    scope: 'all' as const,
    sessionId: 'session-this',
    filter: 'all' as const,
    activeLetterOf: () => undefined,
    nowMs: FIXTURE_NOW
  }

  it('keeps archived sets out of the groups and out of the menu count', () => {
    const groups = buildMobilePrototypeGroups({ ...input, designSystems: [] })
    expect(groups.flatMap((group) => group.rows.map((row) => row.set.requestId))).toEqual([
      'req-this',
      'req-other'
    ])
    expect(mobilePrototypeMenuCount(input.sets, 'session-this')).toBe(1)
  })

  it('lists them in the Archived rows, under the scope and the agent filter', () => {
    expect(buildMobilePrototypeArchivedRows(input).map((row) => row.set.requestId)).toEqual([
      'req-archived'
    ])
    expect(
      buildMobilePrototypeArchivedRows({ ...input, scope: 'chat', sessionId: 'session-other' })
    ).toEqual([])
    expect(buildMobilePrototypeArchivedRows({ ...input, filter: 'claude' })).toEqual([])
  })
})
