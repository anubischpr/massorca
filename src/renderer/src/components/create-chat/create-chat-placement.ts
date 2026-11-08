import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import type * as FloatingCreateLaunch from '@/lib/floating-workspace-create-launch'

/** The floating workspace placement: the New Session tab a started session replaces, if one waits on it. */
export type FloatingWorkspacePlacement = {
  kind: 'floating-workspace'
  createTabId: string | null
}

/**
 * Where a started session is shown. The main window opens its workspace there; the floating
 * workspace shows the session by reference, in place of the New Session tab that started it.
 */
export type CreateChatPlacement = 'main-window' | FloatingWorkspacePlacement

export function isFloatingPlacement(
  placement: CreateChatPlacement
): placement is FloatingWorkspacePlacement {
  return placement !== 'main-window'
}

/** Opens the workspace in the main window; false when it cannot be opened. */
export function openCreateChatWorkspace(
  worktreeId: string,
  placement: CreateChatPlacement
): boolean {
  if (isFloatingPlacement(placement)) {
    return true
  }
  return activateAndRevealWorkspace(worktreeId, { providesInitialSurface: true }) !== false
}

// Why loaded late: the main-window chat path never needs the floating launch graph.
export function loadFloatingCreateLaunch(): Promise<typeof FloatingCreateLaunch> {
  return import('@/lib/floating-workspace-create-launch')
}

/** The workspace's tab ids now, so a session its launch opens can be told apart from the rest. */
export function workspaceTabIds(worktreeId: string): ReadonlySet<string> {
  return new Set(
    (useAppStore.getState().unifiedTabsByWorktree[worktreeId] ?? []).map((tab) => tab.id)
  )
}
