import { describe, expect, it, vi } from 'vitest'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { repairActiveTerminalTab } from './use-active-terminal-repair'

const A = 'repo::/work/a'
const B = 'repo::/work/b'

function tab(id: string, worktreeId: string): TerminalTab {
  return {
    id,
    ptyId: null,
    worktreeId,
    title: id,
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

describe('repairing the active terminal while a pane shows another workspace’s session', () => {
  it('leaves the focused session alone, though it is not one of the layout’s own terminals', () => {
    const setActiveTab = vi.fn()
    // The layout on screen is A's; the focus follows B's session shown in one of its panes.
    const repaired = repairActiveTerminalTab({
      activeTabType: 'terminal',
      activeTabId: 'b-term',
      activeTabIdByWorktree: { [A]: 'a-term', [B]: 'b-term' },
      activeWorktreeId: B,
      renderedActiveWorktreeId: A,
      setActiveTab,
      tabs: [tab('a-term', A)]
    })
    expect(repaired).toBe(false)
    expect(setActiveTab).not.toHaveBeenCalled()
  })

  it('still repairs a stale active terminal of the workspace on screen', () => {
    const setActiveTab = vi.fn()
    const repaired = repairActiveTerminalTab({
      activeTabType: 'terminal',
      activeTabId: 'gone',
      activeTabIdByWorktree: { [A]: 'a-term' },
      activeWorktreeId: A,
      renderedActiveWorktreeId: A,
      setActiveTab,
      tabs: [tab('a-term', A)]
    })
    expect(repaired).toBe(true)
    expect(setActiveTab).toHaveBeenCalledWith('a-term')
  })
})
