import { describe, expect, it } from 'vitest'
import { getDefaultWorkspaceSession } from '../../shared/constants'
import type { TabGroup } from '../../shared/tab-types'
import type { WorkspaceSessionState } from '../../shared/workspace-session-state-types'
import { retireTerminalSurfaceFromPersistence } from './mobile-session-terminal-persistence-retirement'

const A = 'repo::/workspace-a'
const B = 'repo::/workspace-b'

function terminalRow(id: string, worktreeId: string, ptyId: string) {
  return {
    id,
    ptyId,
    worktreeId,
    title: id,
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 1
  }
}

function terminalTab(id: string, worktreeId: string, groupId: string) {
  return {
    id,
    entityId: id,
    groupId,
    worktreeId,
    contentType: 'terminal' as const,
    label: id,
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 1
  }
}

function session(extraGroup: TabGroup): WorkspaceSessionState {
  return {
    ...getDefaultWorkspaceSession(),
    tabsByWorktree: {
      [A]: [terminalRow('a-term', A, 'pty-a')],
      [B]: [terminalRow('b-term', B, 'pty-b')]
    },
    terminalLayoutsByTabId: {
      'a-term': {
        root: { type: 'leaf', leafId: 'leaf-a' },
        activeLeafId: 'leaf-a',
        expandedLeafId: null,
        ptyIdsByLeafId: { 'leaf-a': 'pty-a' }
      },
      'b-term': {
        root: { type: 'leaf', leafId: 'leaf-b' },
        activeLeafId: 'leaf-b',
        expandedLeafId: null,
        ptyIdsByLeafId: { 'leaf-b': 'pty-b' }
      }
    },
    unifiedTabs: {
      [A]: [terminalTab('a-term', A, 'a-main')],
      [B]: [terminalTab('b-term', B, 'b-main')]
    },
    tabGroups: {
      [A]: [
        { id: 'a-main', worktreeId: A, activeTabId: 'a-term', tabOrder: ['a-term'] },
        extraGroup
      ],
      [B]: [{ id: 'b-main', worktreeId: B, activeTabId: 'b-term', tabOrder: ['b-term'] }]
    },
    tabGroupLayouts: {
      [A]: {
        type: 'split',
        direction: 'horizontal',
        first: { type: 'leaf', groupId: 'a-main' },
        second: { type: 'leaf', groupId: extraGroup.id }
      },
      [B]: { type: 'leaf', groupId: 'b-main' }
    }
  }
}

const refPane: TabGroup = {
  id: 'a-ref',
  worktreeId: A,
  activeTabId: null,
  tabOrder: [],
  sessionRef: { worktreeId: B, tabId: 'b-term' }
}

describe('closing a terminal while a pane shows another workspace’s session', () => {
  it('keeps the pane when the terminal closes in the workspace that shows it', () => {
    const result = retireTerminalSurfaceFromPersistence(session(refPane), {
      worktreeId: A,
      parentTabId: 'a-term',
      leafId: 'leaf-a',
      ptyId: 'pty-a'
    })
    expect(result.tabGroups?.[A].map((group) => group.id)).toEqual(['a-ref'])
    expect(result.tabGroups?.[A][0].sessionRef).toEqual(refPane.sessionRef)
    expect(result.tabGroupLayouts?.[A]).toEqual({ type: 'leaf', groupId: 'a-ref' })
  })

  it('keeps the pane when a terminal closes in the workspace that owns the session', () => {
    const result = retireTerminalSurfaceFromPersistence(session(refPane), {
      worktreeId: B,
      parentTabId: 'b-term',
      leafId: 'leaf-b',
      ptyId: 'pty-b'
    })
    expect(result.tabGroups?.[A].map((group) => group.id)).toEqual(['a-main', 'a-ref'])
    expect(result.tabGroupLayouts?.[A]).toMatchObject({ type: 'split' })
  })

  it('still drops an empty pane that references nothing, as before', () => {
    const empty: TabGroup = { id: 'a-empty', worktreeId: A, activeTabId: null, tabOrder: [] }
    const result = retireTerminalSurfaceFromPersistence(session(empty), {
      worktreeId: A,
      parentTabId: 'a-term',
      leafId: 'leaf-a',
      ptyId: 'pty-a'
    })
    expect(result.tabGroups?.[A] ?? []).toEqual([])
  })
})
