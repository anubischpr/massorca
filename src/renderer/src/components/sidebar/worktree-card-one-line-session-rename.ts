import { structuredChatTabById } from '@/lib/structured-chat-tab-index'
import { useAppStore } from '@/store'

/** A chat session is named by its chat tab's label, as `/rename` does; a terminal session by its tab title. */
export function renameOneLineSession(tab: { id: string; worktreeId: string }, name: string): void {
  const state = useAppStore.getState()
  // Why: setTabCustomTitle touches terminal tabs only, so a chat session's rename silently did nothing.
  if (structuredChatTabById(state.unifiedTabsByWorktree, tab.worktreeId, tab.id)) {
    state.setTabCustomLabel(tab.id, name)
    return
  }
  state.setTabCustomTitle(tab.id, name)
}
