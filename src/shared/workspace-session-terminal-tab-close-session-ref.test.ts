import { describe, expect, it } from 'vitest'
import { getDefaultWorkspaceSession } from './constants'
import type { TabGroup } from './tab-types'
import type { WorkspaceSessionState } from './workspace-session-state-types'
import { closeTerminalTabInWorkspaceSession } from './workspace-session-terminal-tab-close'

const A = 'repo::/workspace-a'
const B = 'repo::/workspace-b'

function session(extraGroup: TabGroup): WorkspaceSessionState {
  return {
    ...getDefaultWorkspaceSession(),
    activeWorktreeId: A,
    tabsByWorktree: {
      [A]: [
        {
          id: 'a-term',
          ptyId: 'pty-a',
          worktreeId: A,
          title: 'a-term',
          customTitle: null,
          color: null,
          sortOrder: 0,
          createdAt: 1
        }
      ]
    },
    unifiedTabs: {
      [A]: [
        {
          id: 'a-term',
          entityId: 'a-term',
          groupId: 'a-main',
          worktreeId: A,
          contentType: 'terminal',
          label: 'a-term',
          customLabel: null,
          color: null,
          sortOrder: 0,
          createdAt: 1
        }
      ]
    },
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
    },
    activeGroupIdByWorktree: { [A]: 'a-main' }
  }
}

describe('closing a terminal tab while a pane shows another workspace’s session', () => {
  it('keeps the pane and its place in the layout', () => {
    const refPane: TabGroup = {
      id: 'a-ref',
      worktreeId: A,
      activeTabId: null,
      tabOrder: [],
      sessionRef: { worktreeId: B, tabId: 'b-term' }
    }
    const result = closeTerminalTabInWorkspaceSession(session(refPane), A, 'a-term')
    expect(result.closed).toBe(true)
    expect(result.session.tabGroups?.[A].map((group) => group.id)).toEqual(['a-ref'])
    expect(result.session.tabGroups?.[A][0].sessionRef).toEqual(refPane.sessionRef)
    expect(result.session.tabGroupLayouts?.[A]).toEqual({ type: 'leaf', groupId: 'a-ref' })
  })

  it('still drops an empty pane that references nothing, as before', () => {
    const empty: TabGroup = { id: 'a-empty', worktreeId: A, activeTabId: null, tabOrder: [] }
    const result = closeTerminalTabInWorkspaceSession(session(empty), A, 'a-term')
    expect(result.session.tabGroups?.[A] ?? []).toEqual([])
  })
})
