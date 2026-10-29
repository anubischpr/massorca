import { describe, expect, it } from 'vitest'
import { agentHistoryScopeTabs } from './agent-history-scope-tabs'

describe('agentHistoryScopeTabs', () => {
  it('names the workspace tab This worktree for a git worktree', () => {
    expect(agentHistoryScopeTabs(false)).toEqual([
      { scope: 'workspace', label: 'This worktree' },
      { scope: 'project', label: 'Project' },
      { scope: 'all', label: 'All' }
    ])
  })

  it('names the workspace tab This folder for a folder workspace, keeping the scope value', () => {
    const tabs = agentHistoryScopeTabs(true)

    expect(tabs.map((tab) => tab.scope)).toEqual(['workspace', 'project', 'all'])
    expect(tabs.map((tab) => tab.label)).toEqual(['This folder', 'Project', 'All'])
  })
})
