import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toWebTerminalSurfaceTabId } from '../../../../shared/terminal-surface-id'
import type { Tab, TabGroup } from '../../../../shared/tab-types'
import { applyWebSessionTabsSnapshot } from './snapshot-api'
import type { WebSessionTabsSyncState } from './state'
import { buildMirroredHostGroups } from './layout-groups'
import { retainGroupsAfterMirrorMerge } from './apply-preparation-groups'
import {
  ENV,
  LEAF_ID,
  NOW,
  WT,
  layoutHasGroup,
  makeSnapshot,
  makeState,
  resetWebSessionTabsSyncTestState
} from '../web-session-tabs-sync-test-harness'

vi.mock('../../store', () => ({ useAppStore: { setState: vi.fn() } }))

const HOST_GROUP = 'host-group-1'
const REF_GROUP = 'ref-group'
const OTHER_WT = 'repo::/other-worktree'
const T1 = toWebTerminalSurfaceTabId('host-tab-1')

const refGroup: TabGroup = {
  id: REF_GROUP,
  worktreeId: WT,
  activeTabId: null,
  tabOrder: [],
  sessionRef: { worktreeId: OTHER_WT, tabId: 'other-session' }
}

function terminalTab(): Tab {
  return {
    id: T1,
    worktreeId: WT,
    groupId: HOST_GROUP,
    contentType: 'terminal',
    entityId: T1,
    label: T1,
    sortOrder: 0,
    createdAt: NOW,
    isPreview: false,
    isPinned: false,
    customLabel: null,
    color: null
  }
}

function stateWith(group: TabGroup): WebSessionTabsSyncState {
  return makeState({
    activeGroupIdByWorktree: { [WT]: HOST_GROUP },
    groupsByWorktree: {
      [WT]: [{ id: HOST_GROUP, worktreeId: WT, activeTabId: T1, tabOrder: [T1] }, group]
    },
    layoutByWorktree: {
      [WT]: {
        type: 'split',
        direction: 'horizontal',
        first: { type: 'leaf', groupId: HOST_GROUP },
        second: { type: 'leaf', groupId: group.id }
      }
    },
    unifiedTabsByWorktree: { [WT]: [terminalTab()] }
  })
}

function snapshot() {
  return makeSnapshot(
    [
      {
        type: 'terminal',
        id: `host-tab-1::${LEAF_ID}`,
        title: 'host-tab-1',
        parentTabId: 'host-tab-1',
        leafId: LEAF_ID,
        isActive: true,
        status: 'ready',
        terminal: 'terminal-1'
      }
    ],
    {
      activeGroupId: HOST_GROUP,
      activeTabId: `host-tab-1::${LEAF_ID}`,
      tabGroups: [
        { id: HOST_GROUP, activeTabId: 'host-tab-1', tabOrder: ['host-tab-1'], recentTabIds: [] }
      ],
      tabGroupLayout: { type: 'leaf', groupId: HOST_GROUP }
    }
  )
}

beforeEach(() => resetWebSessionTabsSyncTestState())

describe('a pane that shows another workspace’s session, in a paired worktree', () => {
  // A paired host never sends sessionRef, so a snapshot must leave the client's reference alone.
  it('survives a snapshot from a host that knows nothing about references', () => {
    const state = stateWith(refGroup)
    const next = {
      ...state,
      ...applyWebSessionTabsSnapshot(state, snapshot(), ENV, NOW)
    }
    const kept = next.groupsByWorktree[WT].find((group) => group.id === REF_GROUP)
    expect(kept?.sessionRef).toEqual(refGroup.sessionRef)
    expect(layoutHasGroup(next.layoutByWorktree[WT], REF_GROUP)).toBe(true)
  })
})

describe('mirroring host groups next to client groups', () => {
  const args = {
    hostGroups: [
      { id: HOST_GROUP, activeTabId: 'host-tab-1', tabOrder: ['host-tab-1'], recentTabIds: [] }
    ],
    hostToLocalTabId: new Map([['host-tab-1', T1]]),
    mirroredUnifiedIds: new Set([T1]),
    nextActiveUnifiedTabId: T1,
    now: NOW,
    validUnifiedTabIds: new Set([T1]),
    environmentId: ENV,
    worktreeId: WT,
    clientGroupIdByLocalTabId: new Map<string, string>()
  }

  it('keeps a client pane that references a session', () => {
    const groups = buildMirroredHostGroups({ ...args, currentGroups: [refGroup] })
    expect(groups?.map((group) => group.id)).toEqual([HOST_GROUP, REF_GROUP])
  })

  it('still drops an empty client pane that references nothing', () => {
    const empty: TabGroup = { id: 'plain-empty', worktreeId: WT, activeTabId: null, tabOrder: [] }
    const groups = buildMirroredHostGroups({ ...args, currentGroups: [empty] })
    expect(groups?.map((group) => group.id)).toEqual([HOST_GROUP])
  })
})

describe('merging the mirrored tabs into the target group', () => {
  const target: TabGroup = { id: HOST_GROUP, worktreeId: WT, activeTabId: null, tabOrder: [] }

  it('keeps a pane that references a session', () => {
    expect(
      retainGroupsAfterMirrorMerge([target, refGroup], HOST_GROUP, WT).map((group) => group.id)
    ).toEqual([HOST_GROUP, REF_GROUP])
  })

  it('still prunes an empty pane that references nothing', () => {
    const empty: TabGroup = { id: 'plain-empty', worktreeId: WT, activeTabId: null, tabOrder: [] }
    expect(
      retainGroupsAfterMirrorMerge([target, empty], HOST_GROUP, WT).map((group) => group.id)
    ).toEqual([HOST_GROUP])
  })
})
