import type { MobileSessionTab } from './mobile-session-route-types'

export type ChatSessionTab = Extract<MobileSessionTab, { type: 'agent-session' }>

/**
 * The chat that Plan, Summary and Artifacts act on from any pane: the active tab when it is a chat,
 * otherwise the worktree's first chat, the one the Chat segment returns to. Null without a chat.
 */
export function chatSessionTargetOf(
  tabs: readonly MobileSessionTab[],
  active: MobileSessionTab | null
): ChatSessionTab | null {
  if (active?.type === 'agent-session') {
    return active
  }
  return tabs.find((tab): tab is ChatSessionTab => tab.type === 'agent-session') ?? null
}
