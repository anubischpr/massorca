import React from 'react'
import { AlertCircle, AlertTriangle, ChevronDown, ServerOff } from 'lucide-react'

import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { resolveRepoHeaderColor } from './project-header-color'
import { WorktreeCardSshHostControl } from './WorktreeCardSshHostControl'
import { RepoIdentityChip } from './worktree-card-header'
import type { WorktreeCardController } from './use-worktree-card-controller'

export function BranchRowHostState({
  card
}: {
  card: WorktreeCardController
}): React.JSX.Element | null {
  const {
    repo,
    sshStatus,
    sshTargetLabel,
    sshTargetRemoved,
    sshOwnerEnvironmentId,
    isSshDisconnected,
    isRuntimeDisconnected,
    runtimeHostLabel,
    stopQuickActionPointerPropagation
  } = card
  if (repo?.connectionId && isSshDisconnected) {
    return (
      <WorktreeCardSshHostControl
        targetId={repo.connectionId}
        targetLabel={sshTargetLabel || repo.displayName}
        status={sshStatus}
        targetRemoved={sshTargetRemoved}
        sshOwnerEnvironmentId={sshOwnerEnvironmentId}
        iconOnly
        onPointerDown={stopQuickActionPointerPropagation}
      />
    )
  }
  if (!repo?.connectionId && isRuntimeDisconnected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0">
            <ServerOff className="size-3 text-destructive" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {runtimeHostLabel
            ? translate(
                'auto.components.sidebar.WorktreeCard.runtimeHostDisconnectedNamed',
                '{{hostName}} disconnected',
                { hostName: runtimeHostLabel }
              )
            : translate(
                'auto.components.sidebar.WorktreeCard.runtimeHostDisconnected',
                'Server disconnected'
              )}
        </TooltipContent>
      </Tooltip>
    )
  }
  return null
}

export function BranchRowDeleteFailed({
  card
}: {
  card: WorktreeCardController
}): React.JSX.Element | null {
  const { worktree, isDeleting } = card
  if (!worktree.removalError || isDeleting) {
    return null
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="flex shrink-0 items-center gap-1 text-[11px] leading-none text-destructive"
          data-worktree-card-delete-failed=""
        >
          <AlertTriangle className="size-3 shrink-0" />
          {translate('auto.components.sidebar.WorktreeCard.deleteFailed', 'Delete failed')}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="max-w-72 break-words">
        {worktree.removalError}
      </TooltipContent>
    </Tooltip>
  )
}

export function BranchRowLineageToggle({
  card
}: {
  card: WorktreeCardController
}): React.JSX.Element | null {
  const {
    showLineageChildChip,
    lineageCollapsed,
    lineageChildCount,
    onLineageToggle,
    lineageChildAriaLabel,
    stopQuickActionPointerPropagation
  } = card
  if (!showLineageChildChip) {
    return null
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-workspace-board-preserve-open=""
          className="inline-flex h-5 shrink-0 items-center gap-0.5 rounded-sm px-0.5 text-[10px] tabular-nums text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
          aria-label={lineageChildAriaLabel}
          aria-expanded={!lineageCollapsed}
          onPointerDown={stopQuickActionPointerPropagation}
          onClick={(e) => {
            e.stopPropagation()
            onLineageToggle?.(e)
          }}
        >
          {lineageCollapsed ? <span>+{lineageChildCount}</span> : null}
          <ChevronDown
            className={cn('size-3 transition-transform', lineageCollapsed && '-rotate-90')}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {lineageCollapsed
          ? translate('auto.components.sidebar.WorktreeCard.8cb634cda6', 'Show child workspaces')
          : translate('auto.components.sidebar.WorktreeCard.57eaa61b55', 'Hide child workspaces')}
      </TooltipContent>
    </Tooltip>
  )
}

/** Pinned rows mix projects under no project header, so each carries its project's icon. */
export function BranchRowPinnedRepoIcon({
  card,
  show
}: {
  card: WorktreeCardController
  show: boolean
}): React.JSX.Element | null {
  const { repo } = card
  if (!show || !repo) {
    return null
  }
  return (
    <RepoIdentityChip repo={repo}>
      <RepoIconGlyph
        repoIcon={repo.repoIcon}
        color={resolveRepoHeaderColor(repo.badgeColor)}
        className="size-full"
        iconClassName="size-3"
      />
    </RepoIdentityChip>
  )
}

/** The auto-rename failure chip: its error can be raw CLI output, so it opens a dialog. */
export function BranchRowRenameFailed({
  card
}: {
  card: WorktreeCardController
}): React.JSX.Element | null {
  const {
    worktree,
    titleRenaming,
    stopQuickActionPointerPropagation,
    handleOpenRenameErrorDialog
  } = card
  if (
    typeof worktree.firstAgentMessageRenameError !== 'string' ||
    worktree.firstAgentMessageRenameError.length === 0 ||
    titleRenaming
  ) {
    return null
  }
  const label = translate(
    'auto.components.sidebar.WorktreeCard.02e19349f4',
    'Auto-rename failed: view error'
  )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-4 shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10"
          aria-label={label}
          onPointerDown={stopQuickActionPointerPropagation}
          onClick={handleOpenRenameErrorDialog}
          onDoubleClick={handleOpenRenameErrorDialog}
        >
          <AlertCircle className="size-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {translate(
          'auto.components.sidebar.WorktreeCard.4eba2ea99e',
          'Auto-name failed. Click to see details.'
        )}
      </TooltipContent>
    </Tooltip>
  )
}
