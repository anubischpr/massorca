import React from 'react'
import { Moon, Pin, PinOff, Trash2 } from 'lucide-react'

import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getWorktreeLookupIndex } from '@/store/github/worktree-refresh'
import { useAllWorktrees } from '@/store/selectors'
import type { Worktree } from '../../../../shared/worktree/types'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'
import { runSleepWorktrees } from './sleep-worktree-flow'
import { hasSleepableWorkspaceActivity } from './workspace-lineage-menu-actions'
import { getWorkspaceDeleteLineage } from './workspace-delete-lineage'
import {
  createWorktreeContextMenuDeleteIntent,
  deferWorktreeContextMenuDeleteIntent
} from './worktree-context-menu-delete-intent'
import { getDeleteStateForWorktreeHost } from './worktree-delete-state-host-match'

/**
 * Which removal a session row offers for the worktree it runs in. A main checkout has none: on the
 * branch menu it removes the whole project, which is too far from a session row to offer here.
 */
export function getSessionWorktreeRemoval(
  worktree: Pick<Worktree, 'id' | 'isMainWorktree'>
): { kind: 'folder'; folderWorkspaceId: string } | { kind: 'worktree' } | null {
  const scope = parseWorkspaceKey(worktree.id)
  if (scope?.type === 'folder') {
    return { kind: 'folder', folderWorkspaceId: scope.folderWorkspaceId }
  }
  return worktree.isMainWorktree ? null : { kind: 'worktree' }
}

/**
 * The actions a worktree loses when its row is hidden under a parent's session, running the branch
 * menu's own flows and confirmations. Mounted only while the session menu is open.
 */
export function OneLineSessionWorktreeItems({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  // Why unique: a session row knows only the bare id, so an id two hosts share fails closed.
  const worktree = useAppStore(
    (s) => getWorktreeLookupIndex(s).byId.get(worktreeId)?.unique ?? null
  )
  const allWorktrees = useAllWorktrees()
  const lineageById = useAppStore((s) => s.worktreeLineageById)
  const canSleep = useAppStore((s) =>
    hasSleepableWorkspaceActivity(worktreeId, {
      tabsByWorktree: s.tabsByWorktree,
      ptyIdsByTabId: s.ptyIdsByTabId,
      browserTabsByWorktree: s.browserTabsByWorktree
    })
  )
  const isDeleting = useAppStore((s) =>
    worktree
      ? (getDeleteStateForWorktreeHost(worktree, s.deleteStateByWorktreeId)?.isDeleting ?? false)
      : false
  )
  if (!worktree) {
    return null
  }
  const removal = getSessionWorktreeRemoval(worktree)
  const descendantCount = getWorkspaceDeleteLineage(worktree, allWorktrees, lineageById).descendants
    .length
  const removeLabel =
    removal?.kind === 'folder'
      ? translate('auto.components.sidebar.WorktreeContextMenu.250de158fd', 'Remove Workspace')
      : descendantCount > 0
        ? translate(
            'auto.components.sidebar.WorktreeContextMenu.deleteWithDescendants',
            'Delete with Descendants…'
          )
        : translate('auto.components.sidebar.WorktreeContextMenu.f4475537d8', 'Delete')
  return (
    <>
      <ContextMenuSeparator />

      <ContextMenuItem
        disabled={isDeleting}
        onSelect={() =>
          useAppStore.getState().setWorktreesPinnedAndReveal([worktree.id], !worktree.isPinned)
        }
      >
        {worktree.isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        {worktree.isPinned
          ? translate('auto.components.sidebar.WorktreeContextMenu.697d0f6e1b', 'Unpin')
          : translate('auto.components.sidebar.WorktreeContextMenu.3baa7d6507', 'Pin')}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={isDeleting || !canSleep}
        // Why the delay: the branch menu's own, so the menu has closed before the panels go away.
        onSelect={() => window.setTimeout(() => void runSleepWorktrees([worktree.id]), 50)}
      >
        <Moon className="size-3.5" />
        {translate('auto.components.sidebar.OneLineSessionMenu.sleep', 'Sleep')}
      </ContextMenuItem>
      {removal ? (
        <ContextMenuItem
          variant="destructive"
          disabled={isDeleting}
          onSelect={() =>
            deferWorktreeContextMenuDeleteIntent(
              createWorktreeContextMenuDeleteIntent({
                worktree,
                batchDeleteWorktrees: [],
                isMultiContext: false,
                ...(removal.kind === 'folder'
                  ? { folderWorkspaceId: removal.folderWorkspaceId }
                  : {})
              })
            )
          }
        >
          <Trash2 className="size-3.5" />
          {removeLabel}
        </ContextMenuItem>
      ) : null}
    </>
  )
}
