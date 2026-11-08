import { parsePaneKey } from '../../shared/stable-pane-id'
import { structuredAgentSessionTabId } from '../../shared/structured-agent-session-projection'
import { structuredChatDisplayName } from '../../shared/structured-chat-row-name'
import type { Tab } from '../../shared/tab-types'

/** The facts of one agent row that its conversation name depends on. */
export type RowConversationNameSource = {
  paneKey: string
  worktreeId: string
  /** The live terminal the row runs in; a native chat row has none. */
  terminalHandle?: string
  parentPaneKey: string | null
}

/** What the host knows about a row's chat tab, saved chat name and terminal tab. */
export type RowConversationNameLookups = {
  /** The open tab that shows a native chat, as this host mirrors the workspace session. */
  chatTab: (worktreeId: string, sessionId: string) => Pick<Tab, 'customLabel' | 'label'> | null
  /** The chat's saved name, once it has one. */
  chatSavedName: (sessionId: string) => string | null | undefined
  /** The name the terminal's tab gives its pane, when it has one. */
  terminalName: (terminalHandle: string) => string | null
}

const CHAT_TAB_PREFIX = structuredAgentSessionTabId('')

/** The session a native chat row runs, from its pane key; null for a terminal row. */
function chatSessionIdOf(paneKey: string): string | null {
  const tabId = parsePaneKey(paneKey)?.tabId
  if (!tabId?.startsWith(CHAT_TAB_PREFIX) || tabId.length === CHAT_TAB_PREFIX.length) {
    return null
  }
  return tabId.slice(CHAT_TAB_PREFIX.length)
}

/**
 * The name a row shows for its conversation, as desktop shows it, or null when it names none. A row
 * that shares its parent's tab names nothing: that tab's name belongs to the parent.
 */
export function resolveRowConversationName(
  row: RowConversationNameSource,
  lookups: RowConversationNameLookups
): string | null {
  const ownTabId = parsePaneKey(row.paneKey)?.tabId
  const parentTabId = row.parentPaneKey ? parsePaneKey(row.parentPaneKey)?.tabId : undefined
  if (ownTabId !== undefined && parentTabId === ownTabId) {
    return null
  }
  const sessionId = chatSessionIdOf(row.paneKey)
  if (sessionId !== null) {
    const tab = lookups.chatTab(row.worktreeId, sessionId)
    if (!tab) {
      return null
    }
    return (
      structuredChatDisplayName(tab.customLabel, lookups.chatSavedName(sessionId), tab.label) ||
      null
    )
  }
  return row.terminalHandle ? lookups.terminalName(row.terminalHandle) : null
}
