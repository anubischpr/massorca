import { translate } from '@/i18n/i18n'
import type { CreateChatMenuItem } from './create-chat-menu-items'
import type { CreateChatWorktreeOption } from './create-chat-selection'

/** The project's existing worktrees on the picked host, each with its session state on the right. */
export function buildExistingWorktreeMenuItems(
  worktrees: readonly CreateChatWorktreeOption[]
): CreateChatMenuItem[] {
  return worktrees.map((worktree) => ({
    value: worktree.worktreeId,
    label: worktree.branch,
    disabled: worktree.sessions === null,
    trailing: worktreeSessionLabel(worktree.sessions)
  }))
}

function worktreeSessionLabel(sessions: number | null): string {
  if (sessions === null) {
    return translate('components.createChat.worktreeUnverifiable', 'Unverifiable')
  }
  if (sessions === 0) {
    return translate('components.createChat.worktreeNotRunning', 'Not running')
  }
  if (sessions === 1) {
    return translate('components.createChat.worktreeOneSession', '1 session')
  }
  return translate('components.createChat.worktreeSessions', '{{count}} sessions', {
    count: sessions
  })
}
