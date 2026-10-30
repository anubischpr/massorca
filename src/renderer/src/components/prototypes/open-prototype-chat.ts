import { activateStructuredAgentSessionById } from '@/lib/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'

/** Opens a chat in its own worktree: that worktree is shown first, then the chat's tab is activated. */
export function openPrototypeChat(target: { worktreeId: string; sessionId: string }): void {
  if (useAppStore.getState().activeWorktreeId !== target.worktreeId) {
    activateAndRevealWorktree(target.worktreeId)
  }
  activateStructuredAgentSessionById(target)
}
