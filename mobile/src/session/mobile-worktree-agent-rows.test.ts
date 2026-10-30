import { describe, expect, it } from 'vitest'
import { structuredAgentSessionTabId } from '../../../src/shared/structured-agent-session-projection'
import {
  locateStructuredChild,
  parentChatOf,
  paneTabIdOfPaneKey,
  worktreeAgentRowsFromCatalog
} from './mobile-worktree-agent-rows'

const childPane = `${structuredAgentSessionTabId('child-2')}:3f1c2d4e-0000-4000-8000-000000000001`

describe('worktreeAgentRowsFromCatalog', () => {
  it('reads each worktree and its panes, and skips rows and panes it cannot read', () => {
    const rows = worktreeAgentRowsFromCatalog([
      null,
      { worktreeId: 'wt-a', agents: [{ paneKey: 'tab-1:leaf-1', parentPaneKey: null }, 7] },
      { agents: [] },
      { worktreeId: 'wt-b', agents: [{ paneKey: childPane, parentPaneKey: 'tab-1:leaf-1' }] }
    ])

    expect(rows).toEqual([
      { worktreeId: 'wt-a', agents: [{ paneKey: 'tab-1:leaf-1', parentPaneKey: null }] },
      { worktreeId: 'wt-b', agents: [{ paneKey: childPane, parentPaneKey: 'tab-1:leaf-1' }] }
    ])
  })

  it('reads a pane whose parent is not text as a root, and skips a pane with an empty key', () => {
    const rows = worktreeAgentRowsFromCatalog([
      {
        worktreeId: 'wt-c',
        agents: [
          { paneKey: 'tab-9:leaf-9', parentPaneKey: 4 },
          { paneKey: '', parentPaneKey: null }
        ]
      }
    ])

    expect(rows).toEqual([
      { worktreeId: 'wt-c', agents: [{ paneKey: 'tab-9:leaf-9', parentPaneKey: null }] }
    ])
  })

  it('lists no panes for a host from before the agents field', () => {
    expect(worktreeAgentRowsFromCatalog([{ worktreeId: 'wt-old' }])).toEqual([])
  })
})

describe('locateStructuredChild', () => {
  it('finds the worktree and pane of a child structured chat', () => {
    const worktrees = worktreeAgentRowsFromCatalog([
      { worktreeId: 'wt-a', agents: [{ paneKey: 'tab-1:leaf-1', parentPaneKey: null }] },
      { worktreeId: 'wt-b', agents: [{ paneKey: childPane, parentPaneKey: 'tab-1:leaf-1' }] }
    ])

    expect(locateStructuredChild('child-2', worktrees)).toEqual({
      worktreeId: 'wt-b',
      paneKey: childPane
    })
  })

  it('finds nothing for a session with no pane, or for a terminal pane', () => {
    const worktrees = worktreeAgentRowsFromCatalog([
      { worktreeId: 'wt-a', agents: [{ paneKey: 'tab-1:leaf-1', parentPaneKey: null }] }
    ])

    expect(locateStructuredChild('child-2', worktrees)).toBeNull()
    expect(locateStructuredChild('tab-1', worktrees)).toBeNull()
  })
})

describe('paneTabIdOfPaneKey', () => {
  it('reads the tab part before the first separator', () => {
    expect(paneTabIdOfPaneKey('tab-1:leaf-1')).toBe('tab-1')
    expect(paneTabIdOfPaneKey(':leaf-1')).toBeNull()
    expect(paneTabIdOfPaneKey('no-separator')).toBeNull()
  })
})

describe('the name a pane is listed by', () => {
  it('takes the task title, else the display name, and skips a name that is not text', () => {
    const rows = worktreeAgentRowsFromCatalog([
      {
        worktreeId: 'wt-a',
        agents: [
          { paneKey: 'tab-1:leaf-1', parentPaneKey: null, taskTitle: ' Build ', displayName: 'X' },
          { paneKey: 'tab-2:leaf-2', parentPaneKey: null, taskTitle: '', displayName: 'Plan' },
          { paneKey: 'tab-3:leaf-3', parentPaneKey: null, taskTitle: 4, displayName: '  ' }
        ]
      }
    ])
    expect(rows[0]?.agents.map((pane) => pane.title)).toEqual(['Build', 'Plan', undefined])
  })
})

describe('parentChatOf', () => {
  const parentPane = `${structuredAgentSessionTabId('parent-1')}:leaf-1`

  it('locates a named parent chat with its worktree, pane and name', () => {
    const worktrees = [
      { worktreeId: 'wt-a', agents: [{ paneKey: 'tab-9:leaf-9', parentPaneKey: null }] },
      {
        worktreeId: 'wt-b',
        agents: [{ paneKey: parentPane, parentPaneKey: null, title: 'nexuscare-planning' }]
      }
    ]
    expect(parentChatOf('parent-1', worktrees)).toEqual({
      worktreeId: 'wt-b',
      paneKey: parentPane,
      title: 'nexuscare-planning'
    })
  })

  it('is null when no pane holds the chat, or the host lists it without a name', () => {
    const unnamed = [{ worktreeId: 'wt-b', agents: [{ paneKey: parentPane, parentPaneKey: null }] }]
    expect(parentChatOf('parent-1', unnamed)).toBeNull()
    expect(parentChatOf('parent-1', [])).toBeNull()
  })
})
