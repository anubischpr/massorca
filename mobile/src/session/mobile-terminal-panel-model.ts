// The Terminal panel's rules: which tab it shows, its pills, and the terminal a create just added.
// Pure, so the panel's view stays a draw of these answers.

import type { MobileSessionTab, MobileSessionTabType } from './mobile-session-route-types'
import type { ActivePanel } from './session-panel-host'

export type TerminalTab = Extract<MobileSessionTab, { type: 'terminal' }>
type ChatTab = Extract<MobileSessionTab, { type: 'agent-session' }>

export function terminalTabsOf(tabs: readonly MobileSessionTab[]): TerminalTab[] {
  return tabs.filter((tab): tab is TerminalTab => tab.type === 'terminal')
}

/**
 * Whether the Terminal panel takes the session body. It does only while the active tab is a terminal
 * (or there is none to show), so a chat, file or browser that is showing is never covered.
 */
export function isTerminalPanelOpen(input: {
  activePanel: ActivePanel
  activeTabType: MobileSessionTabType | null
  terminalTabCount: number
}): boolean {
  if (input.activePanel !== 'terminal') {
    return false
  }
  return (
    input.activeTabType === null ||
    input.activeTabType === 'terminal' ||
    input.terminalTabCount === 0
  )
}

/** The terminal to select when the panel opens over another tab; null when a terminal is already active. */
export function terminalTabToOpen(
  tabs: readonly MobileSessionTab[],
  active: MobileSessionTab | null
): TerminalTab | null {
  if (active?.type === 'terminal') {
    return null
  }
  return terminalTabsOf(tabs)[0] ?? null
}

/** The chat that Chat returns to from a terminal: the first agent chat, when a terminal is active. */
export function chatTabToReturnTo(
  tabs: readonly MobileSessionTab[],
  active: MobileSessionTab | null
): ChatTab | null {
  if (active?.type !== 'terminal') {
    return null
  }
  return tabs.find((tab): tab is ChatTab => tab.type === 'agent-session') ?? null
}

/** A terminal-backed agent pane: an agent was launched in it, or it reports an agent status. */
export function isAgentTerminalPane(tab: TerminalTab): boolean {
  return Boolean(tab.launchAgent) || (tab.agentStatus ?? null) !== null
}

/** The id of the first terminal tab not in `knownIds`: the one a create just added. */
export function newTerminalTabId(
  knownIds: ReadonlySet<string>,
  tabs: readonly MobileSessionTab[]
): string | null {
  return terminalTabsOf(tabs).find((tab) => !knownIds.has(tab.id))?.id ?? null
}

export type TerminalPanelPill = {
  id: string
  tab: TerminalTab
  label: string
  selected: boolean
  agentPane: boolean
  /** Created from this panel and not yet replaced by another create. */
  fresh: boolean
  /** The tab has no terminal handle yet. */
  pending: boolean
}

export function terminalPanelPills(input: {
  tabs: readonly MobileSessionTab[]
  selectedTabId: string | null
  freshTabId: string | null
}): TerminalPanelPill[] {
  return terminalTabsOf(input.tabs).map((tab) => ({
    id: tab.id,
    tab,
    label: tab.title.trim() || 'Terminal',
    selected: tab.id === input.selectedTabId,
    agentPane: isAgentTerminalPane(tab),
    fresh: tab.id === input.freshTabId,
    pending: typeof tab.terminal !== 'string'
  }))
}

/** The panel's header: every terminal of the worktree, agent panes included, and whose folder. */
export function terminalPanelTitle(count: number, folder?: string | null): string {
  return folder ? `TERMINALS · ${count} in ${folder}` : `TERMINALS · ${count}`
}

/** The line under a terminal the panel just created. */
export function terminalReadyHint(folder?: string | null): string {
  return folder ? `Ready in ${folder} — type a command` : 'Ready — type a command'
}
