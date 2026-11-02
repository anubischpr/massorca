import { describe, expect, it } from 'vitest'
import type { TabGroup } from '../../shared/tab-types'
import type { WorkspaceSessionState } from '../../shared/workspace-session-state-types'
import { rebaseWorkspaceSessionTerminalMembership } from './workspace-session-terminal-membership-authority'

const A = 'repo::/workspace-a'
const B = 'repo::/workspace-b'

function session(extraGroup: TabGroup): WorkspaceSessionState {
  const row = (id: string, worktreeId: string, sortOrder: number) => ({
    id,
    worktreeId,
    ptyId: null,
    title: id,
    customTitle: null,
    color: null,
    sortOrder,
    createdAt: 0
  })
  return {
    activeRepoId: 'repo',
    activeWorktreeId: A,
    activeTabId: null,
    tabsByWorktree: { [A]: [row('a-term', A, 0)], [B]: [row('b-term', B, 0)] },
    terminalLayoutsByTabId: {},
    terminalTopologyRevisionByRepoId: { repo: 1 },
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

describe('rebasing group membership with the host-authoritative terminals', () => {
  it('keeps a pane that shows another workspace’s session, though it holds no tab of its own', () => {
    const incoming = session({
      id: 'a-ref',
      worktreeId: A,
      activeTabId: null,
      tabOrder: [],
      sessionRef: { worktreeId: B, tabId: 'b-term' }
    })
    const result = rebaseWorkspaceSessionTerminalMembership(incoming, incoming)
    expect(result.tabGroups?.[A].map((group) => group.id)).toEqual(['a-main', 'a-ref'])
    expect(result.tabGroups?.[A][1].sessionRef).toEqual({ worktreeId: B, tabId: 'b-term' })
    expect(result.tabGroupLayouts?.[A]).toMatchObject({ type: 'split' })
  })

  it('still drops an empty pane that references nothing, as before', () => {
    const incoming = session({ id: 'a-empty', worktreeId: A, activeTabId: null, tabOrder: [] })
    const result = rebaseWorkspaceSessionTerminalMembership(incoming, incoming)
    expect(result.tabGroups?.[A].map((group) => group.id)).toEqual(['a-main'])
    expect(result.tabGroupLayouts?.[A]).toEqual({ type: 'leaf', groupId: 'a-main' })
  })
})
