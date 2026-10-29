import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'

export const FIXTURE_NOW = Date.parse('2026-10-28T20:20:00.000Z')

export function listedSet(overrides: Partial<PrototypeListedSet> = {}): PrototypeListedSet {
  const requestId = overrides.requestId ?? '20261028-201500-aaaaaa'
  return {
    requestId,
    sessionId: 'session-alpha-0001',
    agent: 'codex',
    worktreeId: 'wt-1',
    chatTitle: 'checkout-flow',
    originalPrompt: 'Design the new checkout, desktop and phone.',
    createdAt: '2026-10-28T20:15:00.000Z',
    count: 3,
    folderPath: `/state/chats/alpha/prototypes/${requestId}`,
    directions: [
      {
        letter: 'A',
        name: 'Single column',
        tradeoff: 'Simplest, longest scroll',
        versions: [
          { version: 1, fileName: `prototypes/${requestId}/A.html`, mtime: FIXTURE_NOW - 120_000 }
        ]
      },
      {
        letter: 'B',
        name: 'Split summary',
        tradeoff: 'Totals always visible',
        versions: [
          { version: 1, fileName: `prototypes/${requestId}/B.html`, mtime: FIXTURE_NOW - 240_000 },
          { version: 2, fileName: `prototypes/${requestId}/B-v2.html`, mtime: FIXTURE_NOW - 60_000 }
        ]
      },
      {
        letter: 'C',
        versions: [
          { version: 1, fileName: `prototypes/${requestId}/C.html`, mtime: FIXTURE_NOW - 240_000 }
        ]
      }
    ],
    ...overrides
  }
}

export function singleDirectionSet(
  overrides: Partial<PrototypeListedSet> = {}
): PrototypeListedSet {
  const requestId = overrides.requestId ?? '20261028-190000-bbbbbb'
  return listedSet({
    requestId,
    count: 1,
    directions: [
      {
        letter: 'A',
        versions: [
          { version: 1, fileName: `prototypes/${requestId}/A.html`, mtime: FIXTURE_NOW - 3_600_000 }
        ]
      }
    ],
    ...overrides
  })
}
