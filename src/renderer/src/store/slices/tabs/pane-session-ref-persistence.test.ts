import { describe, expect, it } from 'vitest'
import { parseWorkspaceSession } from '../../../../../shared/workspace-session-schema'
import type { TabGroup } from '../../../../../shared/tab-types'
import { buildPersistedUnifiedTabSessionData } from '../../../lib/workspace-session-unified-tabs'
import { buildHydratedTabState } from '../tabs-hydration'
import { makeTabGroup, makeUnifiedTab } from '../store-test-helpers'

const A = 'repo::/work/a'
const B = 'repo::/work/b'

function agentSession(id: string, worktreeId: string, groupId: string) {
  return makeUnifiedTab({ id, worktreeId, groupId, contentType: 'agent-session', label: id })
}

/** A holds one session of its own and a pane that shows B's session by reference. */
function snapshot(overrides: { refTabId?: string } = {}) {
  const refGroup: TabGroup = {
    ...makeTabGroup({ id: 'a-ref', worktreeId: A, tabOrder: [], activeTabId: null }),
    sessionRef: { worktreeId: B, tabId: overrides.refTabId ?? 'b-chat' }
  }
  return {
    unifiedTabsByWorktree: {
      [A]: [agentSession('a-chat', A, 'a-main')],
      [B]: [agentSession('b-chat', B, 'b-main')]
    },
    groupsByWorktree: {
      [A]: [
        makeTabGroup({ id: 'a-main', worktreeId: A, tabOrder: ['a-chat'], activeTabId: 'a-chat' }),
        refGroup
      ],
      [B]: [
        makeTabGroup({ id: 'b-main', worktreeId: B, tabOrder: ['b-chat'], activeTabId: 'b-chat' })
      ]
    },
    layoutByWorktree: {
      [A]: {
        type: 'split' as const,
        direction: 'horizontal' as const,
        first: { type: 'leaf' as const, groupId: 'a-main' },
        second: { type: 'leaf' as const, groupId: 'a-ref' }
      },
      [B]: { type: 'leaf' as const, groupId: 'b-main' }
    },
    activeGroupIdByWorktree: { [A]: 'a-main', [B]: 'b-main' }
  }
}

function sessionFrom(persisted: ReturnType<typeof buildPersistedUnifiedTabSessionData>) {
  return {
    activeRepoId: null,
    activeWorktreeId: A,
    activeTabId: null,
    tabsByWorktree: {},
    terminalLayoutsByTabId: {},
    unifiedTabs: persisted.unifiedTabs,
    tabGroups: persisted.tabGroups,
    tabGroupLayouts: persisted.tabGroupLayouts,
    activeGroupIdByWorktree: persisted.activeGroupIdByWorktree
  }
}

describe('a pane that shows another workspace’s session by reference', () => {
  it('is saved with its reference, even though the pane holds no session of its own', () => {
    const persisted = buildPersistedUnifiedTabSessionData(snapshot())
    const ref = persisted.tabGroups?.[A]?.find((group) => group.id === 'a-ref')
    expect(ref?.sessionRef).toEqual({ worktreeId: B, tabId: 'b-chat' })
    expect(persisted.tabGroupLayouts?.[A]).toMatchObject({ type: 'split' })
  })

  it('is not saved when the session it shows is gone, and the layout closes up', () => {
    const persisted = buildPersistedUnifiedTabSessionData(snapshot({ refTabId: 'deleted' }))
    expect(persisted.tabGroups?.[A]?.map((group) => group.id)).toEqual(['a-main'])
    expect(persisted.tabGroupLayouts?.[A]).toEqual({ type: 'leaf', groupId: 'a-main' })
  })

  it('survives a reload: the saved session parses and hydrates with the reference intact', () => {
    const persisted = buildPersistedUnifiedTabSessionData(snapshot())
    const parsed = parseWorkspaceSession(JSON.parse(JSON.stringify(sessionFrom(persisted))))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    const hydrated = buildHydratedTabState(parsed.value, new Set([A, B]))
    const ref = hydrated.groupsByWorktree[A].find((group) => group.id === 'a-ref')
    expect(ref?.sessionRef).toEqual({ worktreeId: B, tabId: 'b-chat' })
    expect(ref?.tabOrder).toEqual([])
    expect(hydrated.layoutByWorktree[A]).toMatchObject({ type: 'split' })
    expect(hydrated.unifiedTabsByWorktree[B].map((tab) => tab.id)).toEqual(['b-chat'])
  })

  it('hydrates without the pane when the session it showed no longer exists', () => {
    const persisted = buildPersistedUnifiedTabSessionData(snapshot())
    const session = sessionFrom(persisted)
    session.unifiedTabs = { ...session.unifiedTabs, [B]: [] }
    const hydrated = buildHydratedTabState(session, new Set([A, B]))
    expect(hydrated.groupsByWorktree[A].map((group) => group.id)).toEqual(['a-main'])
    expect(hydrated.layoutByWorktree[A]).toEqual({ type: 'leaf', groupId: 'a-main' })
  })

  it('keeps every tab when an older build, which ignores the reference, reads the profile', () => {
    const persisted = buildPersistedUnifiedTabSessionData(snapshot())
    const asOlderBuildReadsIt = JSON.parse(JSON.stringify(sessionFrom(persisted)))
    for (const groups of Object.values<TabGroup[]>(asOlderBuildReadsIt.tabGroups)) {
      for (const group of groups) {
        delete group.sessionRef
      }
    }
    const hydrated = buildHydratedTabState(asOlderBuildReadsIt, new Set([A, B]))
    expect(hydrated.unifiedTabsByWorktree[A].map((tab) => tab.id)).toEqual(['a-chat'])
    expect(hydrated.unifiedTabsByWorktree[B].map((tab) => tab.id)).toEqual(['b-chat'])
    expect(hydrated.groupsByWorktree[A].map((group) => group.id)).toEqual(['a-main'])
  })

  it('reads a profile saved before the field existed, and degrades a malformed reference', () => {
    const persisted = buildPersistedUnifiedTabSessionData(snapshot())
    const older = JSON.parse(JSON.stringify(sessionFrom(persisted)))
    older.tabGroups[A].find((group: TabGroup) => group.id === 'a-ref').sessionRef = { nonsense: 1 }
    const parsed = parseWorkspaceSession(older)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      const ref = parsed.value.tabGroups?.[A].find((group) => group.id === 'a-ref')
      expect(ref?.sessionRef).toBeUndefined()
    }
  })
})
