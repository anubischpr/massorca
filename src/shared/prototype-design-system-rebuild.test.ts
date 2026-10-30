import { describe, expect, it } from 'vitest'
import { designSystemRebuildSetsOf } from './prototype-design-system-rebuild'
import type { PrototypeListedSet } from './rpc-contract/prototype-params'

function setOf(overrides: Partial<PrototypeListedSet>): PrototypeListedSet {
  return {
    requestId: 'req-1',
    sessionId: 'session-1',
    agent: 'codex',
    worktreeId: null,
    chatTitle: 'Liquidaciones',
    originalPrompt: 'Design it',
    createdAt: '2026-10-28T20:15:00.000Z',
    count: 2,
    folderPath: '/state/prototypes/req-1',
    directions: [
      { letter: 'A', versions: [{ version: 1, fileName: 'A.html', mtime: 1 }] },
      {
        letter: 'B',
        versions: [
          { version: 1, fileName: 'B.html', mtime: 1 },
          { version: 2, fileName: 'B-v2.html', mtime: 2 }
        ]
      }
    ],
    ...overrides
  }
}

describe('designSystemRebuildSetsOf', () => {
  it('names each set and the version each direction is written at next', () => {
    expect(designSystemRebuildSetsOf([setOf({})])).toEqual([
      {
        title: 'Liquidaciones',
        folderPath: '/state/prototypes/req-1',
        directions: [
          { letter: 'A', nextVersion: 2 },
          { letter: 'B', nextVersion: 3 }
        ]
      }
    ])
  })

  it('leaves out a set with no folder on the host', () => {
    expect(designSystemRebuildSetsOf([setOf({ folderPath: undefined })])).toEqual([])
  })
})
