import type { AgentDotState } from '../worktree/agent-row-display'

/** What the switcher reads from a tab: its kind, its terminal handle, and the agent state it reports. */
export type MobileSessionSwitcherTab = {
  id: string
  type: 'terminal' | 'agent-session' | 'markdown' | 'file' | 'browser'
  terminal?: string | null
  agentStatus?: { state: 'working' | 'blocked' | 'waiting' | 'done' } | null
}

/** What a session row says about its tab, in the switcher's vocabulary. */
export type MobileSessionSwitcherStatus = 'working' | 'waiting' | 'terminal' | 'idle'

export type MobileSessionSwitcherRow<Tab extends MobileSessionSwitcherTab> = {
  tab: Tab
  isActive: boolean
  /** Null for document and browser tabs, which have no agent to report on. */
  status: MobileSessionSwitcherStatus | null
}

/** The active chat's live state; it describes only the tab the chat is showing. */
export type MobileSessionSwitcherLive = { working: boolean; waiting: boolean }

export function mobileSessionSwitcherRows<Tab extends MobileSessionSwitcherTab>(
  tabs: readonly Tab[],
  activeTabId: string | null,
  live: MobileSessionSwitcherLive | null
): MobileSessionSwitcherRow<Tab>[] {
  return tabs.map((tab) => {
    const isActive = tab.id === activeTabId
    return { tab, isActive, status: switcherStatus(tab, isActive ? live : null) }
  })
}

export function mobileSessionSwitcherDot(status: MobileSessionSwitcherStatus): AgentDotState {
  switch (status) {
    case 'working':
      return 'working'
    case 'waiting':
      return 'waiting'
    case 'terminal':
    case 'idle':
      return 'idle'
  }
}

export function mobileSessionSwitcherLabel(status: MobileSessionSwitcherStatus): string {
  switch (status) {
    case 'working':
      return 'Working'
    case 'waiting':
      return 'Waiting for you'
    case 'terminal':
      return 'Terminal running'
    case 'idle':
      return 'Idle'
  }
}

function switcherStatus(
  tab: MobileSessionSwitcherTab,
  live: MobileSessionSwitcherLive | null
): MobileSessionSwitcherStatus | null {
  if (tab.type !== 'terminal' && tab.type !== 'agent-session') {
    return null
  }
  if (live?.waiting) {
    return 'waiting'
  }
  if (live?.working) {
    return 'working'
  }
  if (tab.type === 'agent-session') {
    return 'idle'
  }
  if (tab.agentStatus) {
    return agentStatusToSwitcher(tab.agentStatus.state)
  }
  return tab.terminal ? 'terminal' : 'idle'
}

function agentStatusToSwitcher(
  state: 'working' | 'blocked' | 'waiting' | 'done'
): MobileSessionSwitcherStatus {
  if (state === 'working') {
    return 'working'
  }
  return state === 'blocked' || state === 'waiting' ? 'waiting' : 'idle'
}

/** Chats only: a terminal is not a session, so the switcher chip leaves it out of its count. */
export function mobileChatSessionCount(rows: readonly { tab: { type: string } }[]): number {
  return rows.filter((row) => row.tab.type === 'agent-session').length
}
