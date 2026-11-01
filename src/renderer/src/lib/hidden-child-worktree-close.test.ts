import { describe, expect, it } from 'vitest'
import type { AppState } from '@/store/types'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../../shared/structured-agent-session-projection'
import { folderWorkspaceKey } from '../../../shared/workspace-scope'
import { closingTabRemovesHiddenChildWorktree } from './hidden-child-worktree-close'

const parentTabId = structuredAgentSessionTabId('parent')
const childTabId = structuredAgentSessionTabId('child')
const parentKey = structuredAgentSessionPaneKey(parentTabId, 'parent')
const childKey = structuredAgentSessionPaneKey(childTabId, 'child')

function tab(id: string, worktreeId: string): { id: string; worktreeId: string; title: string } {
  return { id, worktreeId, title: id }
}

function entry(paneKey: string, worktreeId: string, tabId: string, parent?: string): object {
  return {
    paneKey,
    worktreeId,
    tabId,
    state: 'done',
    prompt: '',
    updatedAt: 1,
    stateStartedAt: 1,
    stateHistory: [],
    ...(parent ? { orchestration: { taskId: 't', dispatchId: 'd', parentPaneKey: parent } } : {})
  }
}

function stateFor(overrides: {
  childWorktreeId?: string
  childOnParentWorktree?: boolean
  childTabs?: number
  isMainWorktree?: boolean
  layout?: string
}): AppState {
  const childWorktreeId = overrides.childOnParentWorktree
    ? 'wt-parent'
    : (overrides.childWorktreeId ?? 'wt-child')
  const childTabs = Array.from({ length: overrides.childTabs ?? 1 }, (_, index) =>
    tab(index === 0 ? childTabId : `extra-${index}`, childWorktreeId)
  )
  const terminalTabs: Record<string, unknown[]> = { 'wt-parent': [tab(parentTabId, 'wt-parent')] }
  terminalTabs[childWorktreeId] = [...(terminalTabs[childWorktreeId] ?? []), ...childTabs]
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: partial store; the code under test reads only these slices.
  return {
    settings: { worktreeCardLayout: overrides.layout ?? 'one-line' },
    repos: [],
    worktreesByRepo: {
      repo: [
        { id: 'wt-parent', isMainWorktree: false },
        { id: childWorktreeId, isMainWorktree: overrides.isMainWorktree ?? false }
      ]
    },
    tabsByWorktree: terminalTabs,
    unifiedTabsByWorktree: terminalTabs,
    runtimeAgentOrchestrationByPaneKey: {},
    retainedAgentsByPaneKey: {},
    agentStatusByPaneKey: {
      [parentKey]: entry(parentKey, 'wt-parent', parentTabId),
      [childKey]: entry(childKey, childWorktreeId, childTabId, parentKey)
    }
  } as unknown as AppState
}

describe('closingTabRemovesHiddenChildWorktree', () => {
  it('removes a hidden child worktree when its last tab closes', () => {
    expect(closingTabRemovesHiddenChildWorktree(stateFor({}), 'wt-child')).toBe(true)
  })

  it('never removes the parent worktree for a child running inside it', () => {
    const state = stateFor({ childOnParentWorktree: true })
    expect(closingTabRemovesHiddenChildWorktree(state, 'wt-parent')).toBe(false)
  })

  it('only closes the tab while the worktree holds another tab', () => {
    expect(closingTabRemovesHiddenChildWorktree(stateFor({ childTabs: 2 }), 'wt-child')).toBe(false)
  })

  it('only closes the tab for a main checkout', () => {
    expect(
      closingTabRemovesHiddenChildWorktree(stateFor({ isMainWorktree: true }), 'wt-child')
    ).toBe(false)
  })

  it('never removes a folder workspace', () => {
    const id = folderWorkspaceKey('folder-1')
    expect(closingTabRemovesHiddenChildWorktree(stateFor({ childWorktreeId: id }), id)).toBe(false)
  })

  it('only closes the tab outside the one-line layout, where the row stays listed', () => {
    expect(closingTabRemovesHiddenChildWorktree(stateFor({ layout: 'detailed' }), 'wt-child')).toBe(
      false
    )
  })

  it('only closes the tab for a session with no parent link', () => {
    expect(closingTabRemovesHiddenChildWorktree(stateFor({}), 'wt-parent')).toBe(false)
  })
})
