import React from 'react'
import { Moon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useIsSleepingWorktree } from './use-worktree-sleep-state'
import { WorktreeConflictOperationBadge } from './worktree-card-conflict-badge'
import { WorktreeDeleteQuickAction } from './worktree-card-delete-quick-action'
import {
  BranchRowDeleteFailed,
  BranchRowHostState,
  BranchRowLineageToggle,
  BranchRowPinnedRepoIcon,
  BranchRowRenameFailed
} from './worktree-card-one-line-branch-badges'
import {
  BranchRowLabel,
  BranchRowLeadingIcon,
  BranchRowQualifier,
  BranchRowReviewIcon,
  BranchRowStatusGlyph,
  ROW_ICON_CLASS_NAME
} from './worktree-card-one-line-branch-parts'
import type { WorktreeCardPresentation } from './worktree-card-presentation'
import type { WorktreeCardController } from './use-worktree-card-controller'

export const ONE_LINE_BRANCH_ROW_HEIGHT_PX = 28

type OneLineBranchRowProps = {
  card: WorktreeCardController
  presentation: WorktreeCardPresentation
  hasSessions: boolean
  sessionsCollapsed: boolean
  onToggleSessions: () => void
}

export function OneLineBranchRow({
  card,
  presentation,
  hasSessions,
  sessionsCollapsed,
  onToggleSessions
}: OneLineBranchRowProps): React.JSX.Element {
  const { worktree, conflictOperation, showDeleteQuickAction, handleWorkspaceQuickAction } = card
  const isSleeping = useIsSleepingWorktree(worktree.id)
  const dimmed = card.isSshDisconnected || card.isRuntimeDisconnected
  return (
    <div
      className="flex min-w-0 items-center gap-1.5 pl-1 pr-1.5"
      style={{ height: ONE_LINE_BRANCH_ROW_HEIGHT_PX }}
      data-worktree-card-branch-row=""
    >
      <BranchRowLeadingIcon
        card={card}
        hasSessions={hasSessions}
        sessionsCollapsed={sessionsCollapsed}
        onToggleSessions={onToggleSessions}
      />
      <BranchRowPinnedRepoIcon card={card} show={presentation.showPinnedRepoIcon} />
      <div className={cn('flex min-w-0 flex-1 items-center gap-1.5', dimmed && 'opacity-60')}>
        {/* Why: the hover card already carries the full name, so a truncation tooltip would stack on it. */}
        <BranchRowLabel card={card} tooltipEnabled={!presentation.hasHoverDetails} />
        <BranchRowQualifier card={card} />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {presentation.showConflictOperationBadge && conflictOperation ? (
          <WorktreeConflictOperationBadge operation={conflictOperation} />
        ) : null}
        <BranchRowRenameFailed card={card} />
        <BranchRowDeleteFailed card={card} />
        {isSleeping ? (
          <Moon className={cn(ROW_ICON_CLASS_NAME, 'text-muted-foreground')} aria-hidden />
        ) : null}
        <BranchRowHostState card={card} />
        <BranchRowReviewIcon card={card} />
        <BranchRowLineageToggle card={card} />
        {/* Why: a folded branch, or one with no session rows, speaks for the work it cannot show. */}
        <BranchRowStatusGlyph card={card} show={sessionsCollapsed || !hasSessions} />
        {showDeleteQuickAction ? (
          <WorktreeDeleteQuickAction
            onPointerDown={card.stopQuickActionPointerPropagation}
            onClick={handleWorkspaceQuickAction}
          />
        ) : null}
      </div>
    </div>
  )
}
