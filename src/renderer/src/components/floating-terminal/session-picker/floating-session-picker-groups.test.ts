import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../tab-bar/web-runtime-tab-move-mirror', () => ({ mirrorWebRuntimeTabMove: vi.fn() }))

const { createTestStore, makeTabGroup, makeUnifiedTab, seedStore } =
  await import('../../../store/slices/store-test-helpers')
const { makeWorktree } = await import('../../../store/slices/worktrees-slice-test-fixtures')
const testStore = createTestStore()
vi.mock('../../../store', () => ({ useAppStore: testStore }))

const { listFloatingSessionPickerGroups } = await import('./floating-session-picker-groups')
const { listOtherWorkspaceSessionGroups } = await import('../../tab-group/session-picker-pane')

const FLOATING = 'floating-terminal'
const A = 'repo1::/work/a'
const B = 'repo1::/work/b'
const VPS = 'repo-vps::/srv/app'

function chat(id: string, worktreeId: string, label: string, sessionId = `sess-${id}`) {
  return {
    ...makeUnifiedTab({
      id,
      worktreeId,
      groupId: `${worktreeId}-main`,
      contentType: 'agent-session',
      label
    }),
    entityId: sessionId,
    agentSessionAgent: 'claude' as const
  }
}

function mainGroup(worktreeId: string, tabOrder: string[]) {
  return makeTabGroup({ id: `${worktreeId}-main`, worktreeId, tabOrder, activeTabId: tabOrder[0] })
}

beforeEach(() => {
  seedStore(testStore, {
    repos: [
      { id: 'repo1', path: '/repo1', displayName: 'Orca', badgeColor: '#000', addedAt: 0 },
      { id: 'repo-vps', path: '/srv', displayName: 'Remote app', badgeColor: '#000', addedAt: 0 }
    ],
    worktreesByRepo: {
      repo1: [
        makeWorktree({ id: A, repoId: 'repo1', displayName: 'main' }),
        makeWorktree({ id: B, repoId: 'repo1', displayName: 'feature-login' })
      ],
      'repo-vps': [
        makeWorktree({
          id: VPS,
          repoId: 'repo-vps',
          displayName: 'staging',
          runtimeOwnerEnvironmentId: 'env-vps'
        })
      ]
    },
    runtimeEnvironments: [{ id: 'env-vps', name: 'VPS' }] as never,
    runtimeStatusByEnvironmentId: new Map(),
    activeWorktreeId: A,
    unifiedTabsByWorktree: {
      [A]: [chat('a1', A, 'Plan the release')],
      [B]: [chat('b1', B, 'Fix the login'), chat('b2', B, 'Docs')],
      [VPS]: [chat('v1', VPS, 'Deploy check')]
    },
    groupsByWorktree: {
      [A]: [mainGroup(A, ['a1'])],
      [B]: [mainGroup(B, ['b1', 'b2'])],
      [VPS]: [mainGroup(VPS, ['v1'])]
    },
    activeGroupIdByWorktree: {},
    layoutByWorktree: {}
  })
})

describe('the sessions the floating picker offers', () => {
  it('groups them like the sidebar and names the host that owns each workspace', () => {
    const groups = listFloatingSessionPickerGroups(testStore.getState(), {
      layoutWorktreeId: FLOATING
    })
    expect(groups.map((g) => [g.heading, g.hostLabel, g.candidates.map((c) => c.label)])).toEqual([
      ['Orca / main', 'This computer', ['Plan the release']],
      ['Orca / feature-login', 'This computer', ['Fix the login', 'Docs']],
      ['Remote app / staging', 'VPS', ['Deploy check']]
    ])
    expect(groups[2].hostState).not.toBe('connected')
    expect(groups[0].hostState).toBe('connected')
  })

  it('describes each session with the id its host knows, its agent and its tab', () => {
    const [first] = listFloatingSessionPickerGroups(testStore.getState(), {
      layoutWorktreeId: FLOATING
    })
    expect(first.candidates[0]).toEqual({
      tabId: 'a1',
      worktreeId: A,
      sessionId: 'sess-a1',
      label: 'Plan the release',
      agent: 'claude',
      contentType: 'agent-session'
    })
  })

  it('lists only the sessions the caller accepts, such as the ones with a checklist, and drops empty groups', () => {
    const withChecklist = new Set(['sess-b2', 'sess-v1'])
    const groups = listFloatingSessionPickerGroups(testStore.getState(), {
      layoutWorktreeId: FLOATING,
      accept: (candidate) => candidate.sessionId !== null && withChecklist.has(candidate.sessionId)
    })
    expect(groups.map((g) => [g.heading, g.candidates.map((c) => c.label)])).toEqual([
      ['Orca / feature-login', ['Docs']],
      ['Remote app / staging', ['Deploy check']]
    ])
  })

  it('offers a session some pane already shows only when asked to', () => {
    seedStore(testStore, {
      groupsByWorktree: {
        ...testStore.getState().groupsByWorktree,
        [FLOATING]: [
          {
            ...makeTabGroup({ id: 'ref', worktreeId: FLOATING, tabOrder: [], activeTabId: null }),
            sessionRef: { worktreeId: B, tabId: 'b1' }
          }
        ]
      }
    })
    const labels = (includeReferenced: boolean) =>
      listFloatingSessionPickerGroups(testStore.getState(), {
        layoutWorktreeId: FLOATING,
        includeReferenced
      }).flatMap((g) => g.candidates.map((c) => c.label))
    expect(labels(false)).not.toContain('Fix the login')
    expect(labels(true)).toContain('Fix the login')
  })
})

describe('the split-view picker the floating one extends', () => {
  it('keeps its own output when the new option is left out', () => {
    const state = testStore.getState()
    const plain = listOtherWorkspaceSessionGroups(state, A)
    expect(listOtherWorkspaceSessionGroups(state, A, {})).toEqual(plain)
    expect(listOtherWorkspaceSessionGroups(state, A, { includeReferenced: false })).toEqual(plain)
    expect(plain.map((g) => g.heading)).toEqual(['Orca / feature-login', 'Remote app / staging'])
    expect(plain[0].candidates[0]).toEqual({ tabId: 'b1', label: 'Fix the login', worktreeId: B })
  })
})
