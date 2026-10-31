import React from 'react'
import { ChevronDown, Folder, GitBranch, GitCommitHorizontal } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import {
  normalizeManualDisplayName,
  resolveOneLineRowLabel
} from '../../../../shared/worktree/branch-display-label'
import { SessionStatusGlyphIcon } from './SessionStatusGlyphIcon'
import { TruncatedSidebarLabel } from './truncated-sidebar-label'
import { useWorktreeActivityStatus } from './use-worktree-activity-status'
import { getReviewStatusLabel } from './WorktreeCardStatusSlot'
import { getDirectoryName, shouldBeginWorktreeRename } from './worktree-card-model'
import { ReviewIcon } from './worktree-review-helpers'
import { selectAcknowledgedAgentTimes } from './worktree-card-agent-ack-inputs'
import { worktreeRowGlyph } from './worktree-session-status'
import { WorktreeTitleInlineRename } from './WorktreeTitleInlineRename'
import {
  WorkspaceReviewChecksIndicator,
  workspaceReviewChecksLabel
} from './WorkspaceReviewChecksIndicator'
import type { WorktreeCardController } from './use-worktree-card-controller'

export const ROW_ICON_CLASS_NAME = 'size-[13px] shrink-0'

export function BranchRowLeadingIcon({
  card,
  hasSessions,
  sessionsCollapsed,
  onToggleSessions
}: {
  card: WorktreeCardController
  hasSessions: boolean
  sessionsCollapsed: boolean
  onToggleSessions: () => void
}): React.JSX.Element {
  const { isFolder, detachedHeadDisplay, stopQuickActionPointerPropagation } = card
  const Icon = isFolder ? Folder : detachedHeadDisplay ? GitCommitHorizontal : GitBranch
  if (!hasSessions) {
    return <Icon className={cn(ROW_ICON_CLASS_NAME, 'text-muted-foreground')} aria-hidden />
  }
  const label = sessionsCollapsed
    ? translate('auto.components.sidebar.worktree.card.one.line.expandSessions', 'Show sessions')
    : translate('auto.components.sidebar.worktree.card.one.line.collapseSessions', 'Hide sessions')
  // Why: the chevron takes the icon's place on hover, focus and while folded, so the row stays one glyph wide.
  return (
    <button
      type="button"
      data-workspace-board-preserve-open=""
      className="relative inline-flex size-[13px] shrink-0 items-center justify-center rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
      aria-label={label}
      aria-expanded={!sessionsCollapsed}
      onPointerDown={stopQuickActionPointerPropagation}
      onClick={(e) => {
        e.stopPropagation()
        onToggleSessions()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.stopPropagation()
        }
      }}
    >
      <Icon
        className={cn(
          ROW_ICON_CLASS_NAME,
          'absolute',
          sessionsCollapsed
            ? 'opacity-0'
            : 'group-hover/worktree-card:opacity-0 group-focus-within/worktree-card:opacity-0'
        )}
        aria-hidden
      />
      <ChevronDown
        className={cn(
          ROW_ICON_CLASS_NAME,
          'absolute transition-transform',
          sessionsCollapsed
            ? '-rotate-90'
            : 'opacity-0 group-hover/worktree-card:opacity-100 group-focus-within/worktree-card:opacity-100'
        )}
        aria-hidden
      />
    </button>
  )
}

export function BranchRowLabel({
  card,
  tooltipEnabled
}: {
  card: WorktreeCardController
  tooltipEnabled: boolean
}): React.JSX.Element {
  const {
    worktree,
    branch,
    branchLabel,
    isFolder,
    detachedHeadDisplay,
    visibleCardTitle,
    isDeleting,
    affiliateListMode,
    renameRowKey,
    renamingWorktreeId,
    setRenamingWorktreeId,
    setTitleRenaming,
    titleRenaming,
    handleRenameTitle,
    rowNameRenaming,
    setRowNameRenaming,
    handleRenameRowName
  } = card
  const derivedLabel = isFolder
    ? getDirectoryName(worktree.path)
    : detachedHeadDisplay
      ? detachedHeadDisplay.shortHead
      : branchLabel || branch || worktree.displayName
  const text = resolveOneLineRowLabel(worktree.manualDisplayName, derivedLabel)
  const beginEditing =
    !affiliateListMode && shouldBeginWorktreeRename(renamingWorktreeId, worktree.id, renameRowKey)
  // Why: this row shows the row name, so Rename and Update edit that name, not the workspace title.
  if (beginEditing || rowNameRenaming) {
    return (
      <WorktreeTitleInlineRename
        displayName={normalizeManualDisplayName(worktree.manualDisplayName) ?? ''}
        clearOnEmpty
        disabled={isDeleting || affiliateListMode}
        showUnreadEmphasis={false}
        dimReadTitle={false}
        className="font-mono text-xs leading-5"
        editingClassName="flex-1"
        onEditingChange={affiliateListMode ? undefined : setRowNameRenaming}
        onRename={handleRenameRowName}
        beginEditing={beginEditing}
        onBeginEditingConsumed={affiliateListMode ? undefined : () => setRenamingWorktreeId(null)}
      />
    )
  }
  if (titleRenaming) {
    // Why: while the hover card renames the workspace title, this row keeps showing that title.
    return (
      <WorktreeTitleInlineRename
        displayName={visibleCardTitle}
        disabled={isDeleting || affiliateListMode}
        showUnreadEmphasis={false}
        dimReadTitle={false}
        className="font-mono text-xs leading-5"
        editingClassName="flex-1"
        onEditingChange={affiliateListMode ? undefined : setTitleRenaming}
        onRename={handleRenameTitle}
      />
    )
  }
  return (
    <TruncatedSidebarLabel
      text={text}
      className={cn(
        'font-mono text-xs leading-none',
        worktree.isUnread ? 'font-semibold text-foreground' : 'text-foreground/90'
      )}
      tooltipEnabled={tooltipEnabled}
    />
  )
}

export function BranchRowQualifier({
  card
}: {
  card: WorktreeCardController
}): React.JSX.Element | null {
  const {
    branchQualifier,
    isSshDisconnected,
    isRuntimeDisconnected,
    sshTargetLabel,
    repo,
    runtimeHostLabel
  } = card
  // Why: the host is only named when it is needed to tell rows apart or it cannot be reached.
  const disconnectedHost = isSshDisconnected
    ? sshTargetLabel || repo?.displayName
    : isRuntimeDisconnected
      ? runtimeHostLabel
      : null
  const parts = [
    ...(branchQualifier ? [branchQualifier] : []),
    ...(disconnectedHost && !branchQualifier?.includes(disconnectedHost) ? [disconnectedHost] : [])
  ]
  if (parts.length === 0) {
    return null
  }
  return (
    <span
      className="min-w-0 max-w-[45%] shrink truncate text-[11px] leading-none text-muted-foreground/80"
      data-worktree-card-branch-qualifier=""
    >
      {parts.join(' · ')}
    </span>
  )
}

export function BranchRowReviewIcon({
  card
}: {
  card: WorktreeCardController
}): React.JSX.Element | null {
  const { statusLaneReview, reviewChecks, showPR } = card
  if (!showPR) {
    return null
  }
  const collection = reviewChecks.total > 1 ? reviewChecks : undefined
  if (!collection && !statusLaneReview) {
    return null
  }
  const label = collection
    ? workspaceReviewChecksLabel(collection)
    : statusLaneReview
      ? getReviewStatusLabel(statusLaneReview)
      : ''
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0" data-worktree-card-review-icon="">
          {collection ? (
            <WorkspaceReviewChecksIndicator summary={collection} className={ROW_ICON_CLASS_NAME} />
          ) : statusLaneReview ? (
            <ReviewIcon review={statusLaneReview} className={ROW_ICON_CLASS_NAME} />
          ) : null}
          <span className="sr-only">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function BranchRowStatusGlyph({
  card,
  show
}: {
  card: WorktreeCardController
  show: boolean
}): React.JSX.Element | null {
  const status = useWorktreeActivityStatus(card.worktree.id)
  const agents = card.compactInlineAgentRows
  const acknowledgedAgentTimes = useAppStore(
    useShallow((s) => selectAcknowledgedAgentTimes(s, agents))
  )
  // Why: the sessions this row folds speak for it, so a retained failure outranks live work.
  const glyph = show
    ? worktreeRowGlyph({ agents, acknowledgedAgentTimes, status, isUnread: card.worktree.isUnread })
    : null
  // Why: an unreachable host is lost contact, never an exit, so any status falls back to unconfirmed.
  const shown =
    glyph && (card.isSshDisconnected || card.isRuntimeDisconnected ? 'unconfirmed' : glyph)
  return shown ? <SessionStatusGlyphIcon glyph={shown} /> : null
}
