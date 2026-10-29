import { describe, expect, it } from 'vitest'
import { structuredAgentSessionTabId } from '../../../src/shared/structured-agent-session-projection'
import {
  locateStructuredChild,
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
