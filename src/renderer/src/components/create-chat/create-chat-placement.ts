import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import type * as FloatingHostSession from '@/lib/floating-workspace-host-session'

/**
 * Where a started session is shown. The main window opens its workspace there; the floating
 * workspace shows it by reference and leaves the main window as it is.
 */
export type CreateChatPlacement = 'main-window' | 'floating-workspace'

/** Opens the workspace in the main window; false when it cannot be opened. */
export function openCreateChatWorkspace(
  worktreeId: string,
  placement: CreateChatPlacement
): boolean {
  if (placement === 'floating-workspace') {
    return true
  }
  return activateAndRevealWorkspace(worktreeId, { providesInitialSurface: true }) !== false
}

// Why loaded late: the main-window chat path never needs the floating launch graph.
export function loadFloatingHostSession(): Promise<typeof FloatingHostSession> {
  return import('@/lib/floating-workspace-host-session')
}

/** Shows a started session's tab in the floating workspace. */
export function showCreatedSessionInFloating(worktreeId: string, tabId: string): void {
  void loadFloatingHostSession().then(({ showHostSessionInFloating }) => {
    showHostSessionInFloating(worktreeId, tabId)
  })
}

/** A new worktree's id is unknown until it exists, so its session is not shown in the panel. */
export function announceFloatingNewWorktreeSession(): void {
  toast.info(
    translate(
      'components.createChat.floatingNewWorktree',
      'The session starts once its new workspace is ready. Open it here with Open a session.'
    )
  )
}
