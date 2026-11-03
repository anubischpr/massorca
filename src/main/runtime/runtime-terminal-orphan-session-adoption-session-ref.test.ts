import { describe, expect, it } from 'vitest'
import { getDefaultWorkspaceSession } from '../../shared/constants'
import type { TabGroup } from '../../shared/tab-types'
import type { WorkspaceSessionState } from '../../shared/workspace-session-state-types'
import { buildRuntimeTerminalOrphanSession } from './runtime-terminal-orphan-session-adoption'

const A = 'repo::/workspace-a'
const B = 'repo::/workspace-b'

function session(extraGroup: TabGroup): WorkspaceSessionState {
  return {
    ...getDefaultWorkspaceSession(),
    tabGroups: {
      [A]: [
        { id: 'a-main', worktreeId: A, activeTabId: 'a-term', tabOrder: ['a-term'] },
        extraGroup
      ]
    },
    tabGroupLayouts: {
      [A]: {
        type: 'split',
        direction: 'horizontal',
        first: { type: 'leaf', groupId: 'a-main' },
        second: { type: 'leaf', groupId: extraGroup.id }
      }
    }
  }
}

function adopt(current: WorkspaceSessionState): WorkspaceSessionState {
  return buildRuntimeTerminalOrphanSession({
    session: current,
    sessionWorktreeId: A,
    worktreeId: A,
    request: {
      worktree: A,
      expectedTopologyRevision: 0,
      claims: [],
      activeGroupId: 'a-main'
    },
    validated: [],
    topologyTabsById: new Map(),
    topologyGroups: [],
    getDisplayTitle: () => null
  })
}

describe('adopting orphan terminals while a pane shows another workspace’s session', () => {
  it('keeps the pane and its place in the layout', () => {
    const refPane: TabGroup = {
      id: 'a-ref',
      worktreeId: A,
      activeTabId: null,
      tabOrder: [],
      sessionRef: { worktreeId: B, tabId: 'b-term' }
    }
    const next = adopt(session(refPane))
    expect(next.tabGroups?.[A].map((group) => group.id)).toEqual(['a-main', 'a-ref'])
    expect(next.tabGroups?.[A][1].sessionRef).toEqual(refPane.sessionRef)
    expect(next.tabGroupLayouts?.[A]).toMatchObject({ type: 'split' })
  })

  it('still drops an empty pane that references nothing, as before', () => {
    const empty: TabGroup = { id: 'a-empty', worktreeId: A, activeTabId: null, tabOrder: [] }
    const next = adopt(session(empty))
    expect(next.tabGroups?.[A].map((group) => group.id)).toEqual(['a-main'])
  })
})
