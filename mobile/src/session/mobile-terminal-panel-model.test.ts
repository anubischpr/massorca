import { describe, expect, it } from 'vitest'
import type { MobileSessionTab } from './mobile-session-route-types'
import {
  chatTabToReturnTo,
  isAgentTerminalPane,
  isTerminalPanelOpen,
  newTerminalTabId,
  terminalPanelPills,
  terminalPanelTitle,
  terminalTabToOpen,
  terminalTabsOf,
  type TerminalTab
} from './mobile-terminal-panel-model'

function shell(id: string, overrides: Partial<TerminalTab> = {}): TerminalTab {
  return {
    type: 'terminal',
    id,
    title: 'zsh',
    terminal: `handle-${id}`,
    isActive: false,
    ...overrides
  }
}

function chat(id: string): MobileSessionTab {
  return {
    type: 'agent-session',
    id,
    title: 'Fix the parser',
    sessionId: `session-${id}`,
    agent: 'claude',
    isActive: false
  }
}

describe('isTerminalPanelOpen', () => {
  const open = {
    activePanel: 'terminal' as const,
    activeTabType: 'terminal' as const,
    terminalTabCount: 1
  }

  it('takes the body over an active terminal while the terminal panel is the active panel', () => {
    expect(isTerminalPanelOpen(open)).toBe(true)
  })

  it('takes the body over an active terminal even when another panel docks beside it', () => {
    expect(isTerminalPanelOpen({ ...open, activePanel: null })).toBe(true)
    expect(isTerminalPanelOpen({ ...open, activePanel: 'files' })).toBe(true)
  })

  it('stays closed over a chat unless the terminal panel is the active panel', () => {
    const chatShowing = {
      activePanel: null,
      activeTabType: 'agent-session' as const,
      terminalTabCount: 1
    }
    expect(isTerminalPanelOpen(chatShowing)).toBe(false)
    expect(isTerminalPanelOpen({ ...chatShowing, activePanel: 'files' })).toBe(false)
  })

  it('never covers a chat, file or browser tab that is showing', () => {
    expect(isTerminalPanelOpen({ ...open, activeTabType: 'agent-session' })).toBe(false)
    expect(isTerminalPanelOpen({ ...open, activeTabType: 'markdown' })).toBe(false)
    expect(isTerminalPanelOpen({ ...open, activeTabType: 'browser' })).toBe(false)
  })

  it('opens with its empty state over any tab when the worktree has no terminal', () => {
    expect(
      isTerminalPanelOpen({ ...open, activeTabType: 'agent-session', terminalTabCount: 0 })
    ).toBe(true)
  })

  it('opens while no tab is active yet, so its loading state can show', () => {
    expect(isTerminalPanelOpen({ ...open, activeTabType: null })).toBe(true)
  })
})

describe('terminalTabsOf', () => {
  it('keeps only terminal tabs, in tab order', () => {
    const tabs = [chat('c1'), shell('t1'), chat('c2'), shell('t2')]
    expect(terminalTabsOf(tabs).map((tab) => tab.id)).toEqual(['t1', 't2'])
  })
})

describe('terminalTabToOpen', () => {
  it('selects the first terminal when a chat is active', () => {
    expect(terminalTabToOpen([chat('c1'), shell('t1'), shell('t2')], chat('c1'))?.id).toBe('t1')
  })

  it('selects nothing when a terminal is already active', () => {
    expect(terminalTabToOpen([shell('t1'), shell('t2')], shell('t2'))).toBeNull()
  })

  it('selects nothing when the worktree has no terminal', () => {
    expect(terminalTabToOpen([chat('c1')], chat('c1'))).toBeNull()
  })
})

describe('chatTabToReturnTo', () => {
  it('returns to the first chat when a terminal is active', () => {
    expect(chatTabToReturnTo([shell('t1'), chat('c1'), chat('c2')], shell('t1'))?.id).toBe('c1')
  })

  it('returns nothing when a chat or no tab is already active', () => {
    expect(chatTabToReturnTo([shell('t1'), chat('c1')], chat('c1'))).toBeNull()
    expect(chatTabToReturnTo([shell('t1'), chat('c1')], null)).toBeNull()
  })

  it('returns nothing when the worktree has no chat to return to', () => {
    expect(chatTabToReturnTo([shell('t1')], shell('t1'))).toBeNull()
  })
})

describe('isAgentTerminalPane', () => {
  it('is false for a plain shell and true once an agent was launched in it', () => {
    expect(isAgentTerminalPane(shell('t1', { agentStatus: null }))).toBe(false)
    expect(isAgentTerminalPane(shell('t2', { launchAgent: 'claude' }))).toBe(true)
  })
})

describe('newTerminalTabId', () => {
  it('finds the first terminal the known set does not hold, ignoring chats', () => {
    const tabs = [shell('t1'), chat('c1'), shell('t2')]
    expect(newTerminalTabId(new Set(['t1', 'c1']), tabs)).toBe('t2')
  })

  it('finds nothing when every terminal was already known', () => {
    expect(newTerminalTabId(new Set(['t1']), [shell('t1')])).toBeNull()
  })
})

describe('terminalPanelPills', () => {
  it('marks the selected, fresh, agent and pending pills and names a blank title Terminal', () => {
    const pills = terminalPanelPills({
      tabs: [
        shell('t1', { title: 'zsh' }),
        shell('t2', { title: '   ', launchAgent: 'claude' }),
        shell('t3', { title: 'pnpm test', terminal: null, status: 'pending-handle' })
      ],
      selectedTabId: 't2',
      freshTabId: 't2'
    })
    expect(
      pills.map(({ id, label, selected, fresh, agentPane, pending }) => ({
        id,
        label,
        selected,
        fresh,
        agentPane,
        pending
      }))
    ).toEqual([
      { id: 't1', label: 'zsh', selected: false, fresh: false, agentPane: false, pending: false },
      { id: 't2', label: 'Terminal', selected: true, fresh: true, agentPane: true, pending: false },
      {
        id: 't3',
        label: 'pnpm test',
        selected: false,
        fresh: false,
        agentPane: false,
        pending: true
      }
    ])
  })

  it('lists no pill for a chat-only worktree', () => {
    expect(
      terminalPanelPills({ tabs: [chat('c1')], selectedTabId: 'c1', freshTabId: null })
    ).toEqual([])
  })
})

describe('terminalPanelTitle', () => {
  it('counts every terminal of the worktree in the header', () => {
    expect(terminalPanelTitle(0)).toBe('TERMINALS · 0')
    expect(terminalPanelTitle(3)).toBe('TERMINALS · 3')
  })

  it('names the worktree by its display name, not its folder', () => {
    expect(terminalPanelTitle(2, 'Fix parser')).toBe('TERMINALS · 2 in Fix parser')
    expect(terminalPanelTitle(2, null)).toBe('TERMINALS · 2')
  })
})
