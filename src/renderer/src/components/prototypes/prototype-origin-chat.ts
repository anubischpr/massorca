// The parent chat a delegated set came from, as this client knows it: the worktree that holds its tab, and the tab's name.
import type { Tab } from '../../../../shared/tab-types'
import {
  findStructuredAgentSessionTab,
  findStructuredAgentSessionWorktreeId
} from '@/lib/structured-agent-session-tab-activation'

export type OriginChat = { worktreeId: string; title: string }

/** Where the parent chat is and what it is called; null when this client holds no tab for it or it has no name. */
export function originChatOf(
  unifiedTabsByWorktree: Readonly<Record<string, readonly Tab[]>>,
  sessionId: string
): OriginChat | null {
  const worktreeId = findStructuredAgentSessionWorktreeId(unifiedTabsByWorktree, sessionId)
  if (worktreeId === null) {
    return null
  }
  const tab = findStructuredAgentSessionTab(unifiedTabsByWorktree, {
    workspaceId: worktreeId,
    sessionId
  })
  const title = (tab?.customLabel?.trim() || tab?.label.trim()) ?? ''
  return title.length > 0 ? { worktreeId, title } : null
}
