import type { AgentStatusState, AgentType } from '../shared/agent-status-types'
import type { RuntimeWorktreeAgentRow } from '../shared/runtime-types'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../shared/structured-agent-session-projection'

// Why: a chat row's pane key is `<tab id>:<leaf>` and its tab id embeds the session id. Rebuilding the
// key from the candidate id proves the host derived it, so a key that merely shares the prefix is no chat.
const CHAT_TAB_PREFIX = structuredAgentSessionTabId('')
const MAX_TITLE_LENGTH = 80

export type WorktreeAgentSession = {
  /** What `worktree session-close --session` takes: a terminal handle, or a chat session id. */
  id: string
  /** Null when neither a live terminal nor a chat stands behind the row. */
  kind: 'terminal' | 'chat' | null
  paneKey: string
  agent: AgentType | null
  title: string | null
  state: AgentStatusState
  /** When the row entered its current state. */
  stateStartedAt: number
  updatedAt: number
}

export function chatSessionIdOfPaneKey(paneKey: string): string | null {
  const separator = paneKey.lastIndexOf(':')
  if (!paneKey.startsWith(CHAT_TAB_PREFIX) || separator < CHAT_TAB_PREFIX.length) {
    return null
  }
  const sessionId = paneKey.slice(CHAT_TAB_PREFIX.length, separator)
  if (sessionId.length === 0) {
    return null
  }
  const rebuilt = structuredAgentSessionPaneKey(structuredAgentSessionTabId(sessionId), sessionId)
  return rebuilt === paneKey ? sessionId : null
}

export function projectWorktreeAgentSession(row: RuntimeWorktreeAgentRow): WorktreeAgentSession {
  return {
    ...closeTargetOf(row),
    paneKey: row.paneKey,
    agent: row.agentType,
    title: row.taskTitle || row.displayName || row.prompt || null,
    state: row.state,
    stateStartedAt: row.stateStartedAt,
    updatedAt: row.updatedAt
  }
}

// Why: a terminal handle is the stronger handle (it stops a process); a row with neither keeps its pane key.
function closeTargetOf(row: RuntimeWorktreeAgentRow): Pick<WorktreeAgentSession, 'id' | 'kind'> {
  if (row.terminalHandle) {
    return { id: row.terminalHandle, kind: 'terminal' }
  }
  const chatSessionId = chatSessionIdOfPaneKey(row.paneKey)
  if (chatSessionId) {
    return { id: chatSessionId, kind: 'chat' }
  }
  return { id: row.paneKey, kind: null }
}

export function formatSessionAge(elapsedMs: number): string {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000))
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h`
  }
  return `${Math.floor(hours / 24)}d`
}

export function formatWorktreeAgentSessions(
  sessions: readonly WorktreeAgentSession[],
  now: number
): string {
  if (sessions.length === 0) {
    return 'No agent sessions in this worktree.'
  }
  return sessions
    .map((session) =>
      [
        session.id,
        session.agent ?? '-',
        session.state,
        formatSessionAge(now - session.stateStartedAt),
        oneLineTitle(session.title)
      ].join('  ')
    )
    .join('\n')
}

function oneLineTitle(title: string | null): string {
  if (!title) {
    return '-'
  }
  const line = title.replace(/\s+/g, ' ').trim()
  return line.length > MAX_TITLE_LENGTH ? `${line.slice(0, MAX_TITLE_LENGTH - 3)}...` : line
}
