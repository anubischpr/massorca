import React, { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate } from '@/i18n/i18n'
import {
  initializeRuntimeRepoGit,
  runtimeRepoSupportsGitInit
} from '@/runtime/runtime-repo-git-init-client'
import { useAppStore } from '@/store'
import type { Repo } from '../../../../../../shared/repo-types'
import {
  adoptInitializedGitRepo,
  folderProjectHostOf,
  toastGitInitFailure
} from '../../folder-project-git-init'
import {
  handleRepoHeaderActionPointerDown,
  stopRepoHeaderKeyboardToggle,
  stopRepoHeaderMenuEvent
} from './header-event-guards'

/** "No Git" marker for a folder project; its popover offers Initialize Git when the host supports it. */
export function FolderProjectGitMarker({ repo }: { repo: Repo }): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const [open, setOpen] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const hostId = repo.executionHostId ?? undefined
  const hostKey = hostId ?? ''
  // Why: the capability is asked only once the popover opens, and kept per host.
  const [gitInitSupport, setGitInitSupport] = useState<{
    hostKey: string
    supported: boolean
  } | null>(null)
  const knownHostKey = gitInitSupport?.hostKey
  const canInitGit = gitInitSupport?.hostKey === hostKey && gitInitSupport.supported

  useEffect(() => {
    if (!open || knownHostKey === hostKey) {
      return
    }
    let cancelled = false
    runtimeRepoSupportsGitInit(settings, hostId)
      .then((supported) => {
        if (!cancelled) {
          setGitInitSupport({ hostKey, supported })
        }
      })
      .catch(() => {
        // Why: a failed probe hides Initialize Git without caching, so the next open probes again.
      })
    return () => {
      cancelled = true
    }
  }, [hostId, hostKey, knownHostKey, open, settings])

  const handleInitializeGit = useCallback(async () => {
    setIsInitializing(true)
    try {
      const result = await initializeRuntimeRepoGit(settings, repo.id, hostId)
      if (!result.ok) {
        toastGitInitFailure(result.message ?? result.error)
        return
      }
      await adoptInitializedGitRepo(result.repo, folderProjectHostOf(repo))
      setOpen(false)
    } catch (err) {
      toastGitInitFailure(err instanceof Error ? err.message : String(err))
    } finally {
      setIsInitializing(false)
    }
  }, [hostId, repo, settings])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      // Why: an in-flight init closes the popover itself once it settles.
      if (!isInitializing) {
        setOpen(nextOpen)
      }
    },
    [isInitializing]
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Badge asChild variant="quietOutline" className="shrink-0 cursor-pointer">
          <button
            type="button"
            aria-label={translate(
              'auto.components.sidebar.worktree.list.rows.FolderProjectGitMarker.bcb9e06aae',
              'No Git: show limitations'
            )}
            data-repo-header-action=""
            onClick={stopRepoHeaderMenuEvent}
            onKeyDown={stopRepoHeaderKeyboardToggle}
            onPointerDown={handleRepoHeaderActionPointerDown}
          >
            {translate(
              'auto.components.sidebar.worktree.list.rows.FolderProjectGitMarker.0c2667a80a',
              'No Git'
            )}
          </button>
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80"
        // Why: Radix portals keep React bubbling through the project header; block popover events from toggling or dragging the row.
        onPointerDown={stopRepoHeaderMenuEvent}
        onMouseDown={stopRepoHeaderMenuEvent}
        onPointerUp={stopRepoHeaderMenuEvent}
        onMouseUp={stopRepoHeaderMenuEvent}
        onClick={stopRepoHeaderMenuEvent}
        onKeyDown={stopRepoHeaderMenuEvent}
      >
        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <div className="text-[13px] font-semibold leading-tight">
              {translate(
                'auto.components.sidebar.worktree.list.rows.FolderProjectGitMarker.56aee8fc7f',
                'This project has no Git'
              )}
            </div>
            <p className="text-muted-foreground">
              {translate(
                'auto.components.sidebar.worktree.list.rows.FolderProjectGitMarker.54b5a85dfc',
                'Editor, terminal, and search work. Not available:'
              )}
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-4.5">
            <li>
              {translate(
                'auto.components.sidebar.NonGitFolderDialog.df93b2f2d4',
                'Isolated workspaces and branches'
              )}
            </li>
            <li>
              {translate(
                'auto.components.sidebar.NonGitFolderDialog.7b84fb792a',
                'Child sessions in their own worktree — they would edit the same files as the parent chat'
              )}
            </li>
            <li>
              {translate(
                'auto.components.sidebar.NonGitFolderDialog.8761ae2bfa',
                'Changes, diffs, and commits'
              )}
            </li>
            <li>
              {translate(
                'auto.components.sidebar.NonGitFolderDialog.dfc6969363',
                'Pull requests and reviews'
              )}
            </li>
          </ul>
          <p className="text-muted-foreground">
            {translate(
              'auto.components.sidebar.worktree.list.rows.FolderProjectGitMarker.55fa69d439',
              'Recommended only for exploring folders and non-development work.'
            )}
          </p>
          {canInitGit ? (
            <div className="flex justify-end">
              <Button size="sm" disabled={isInitializing} onClick={handleInitializeGit}>
                {translate(
                  'auto.components.sidebar.worktree.list.rows.FolderProjectGitMarker.938c32c790',
                  'Initialize Git'
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
