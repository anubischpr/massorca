import React from 'react'

import { cn } from '@/lib/utils'
import { getWorkspaceAttachments } from '../../../../shared/workspace-attachments'
import { WorktreeCardHeader } from './worktree-card-header'
import { WorktreeCardIdentityHover } from './worktree-card-identity-hover'
import { WorktreeCardMetaRow } from './worktree-card-meta-row'
import { WorktreeCardOneLineContent } from './worktree-card-one-line'
import type { WorktreeCardPresentation } from './worktree-card-presentation'
import { WorktreeCardSecondaryRows } from './worktree-card-secondary-rows'
import { WorktreeCardStatusSlot } from './WorktreeCardStatusSlot'
import type { WorktreeCardController } from './use-worktree-card-controller'

export function WorktreeCardParentContent({
  card,
  presentation
}: {
  card: WorktreeCardController
  presentation: WorktreeCardPresentation
}): React.JSX.Element {
  const {
    worktree,
    affiliateListMode,
    newCardStyle,
    oneLineCards,
    lineageChildren,
    showStatus,
    unreadTooltip,
    stopQuickActionPointerPropagation,
    handleToggleUnreadQuick,
    statusLaneReview,
    reviewChecks,
    branchIdentityDisplay,
    showInlineAgentList
  } = card
  const { titleOnlyCard, parentContentMarginLeft, showCombinedStatusSlot, showUnreadQuickAction } =
    presentation

  if (oneLineCards) {
    return <WorktreeCardOneLineContent card={card} presentation={presentation} />
  }

  const identityContent = (
    <div
      className="group/worktree-card flex w-full min-w-0 flex-col gap-1.5"
      data-worktree-card-hover-trigger=""
      data-bot-character-zone=""
    >
      <WorktreeCardHeader card={card} presentation={presentation} />
      {presentation.hasMetaRow && <WorktreeCardMetaRow card={card} presentation={presentation} />}
    </div>
  )

  return (
    <div
      className={cn(
        'flex w-full min-w-0 gap-0.5 pl-0',
        titleOnlyCard ? 'items-center' : 'items-start'
      )}
      style={
        parentContentMarginLeft < 0 ? { marginLeft: `${parentContentMarginLeft}px` } : undefined
      }
      data-worktree-card-parent-content=""
    >
      {showCombinedStatusSlot ? (
        <div
          className={cn(
            'flex shrink-0 justify-center',
            newCardStyle ? 'mr-1 w-5 items-center' : 'items-start pt-[2px]',
            affiliateListMode && 'px-1'
          )}
          data-worktree-card-status-slot=""
        >
          <WorktreeCardStatusSlot
            worktreeId={worktree.id}
            showStatus={showStatus}
            showUnreadAction={showUnreadQuickAction}
            isUnread={worktree.isUnread}
            unreadTooltip={unreadTooltip}
            onPointerDown={stopQuickActionPointerPropagation}
            onToggleUnread={handleToggleUnreadQuick}
            prDisplay={statusLaneReview}
            reviewChecks={reviewChecks.total > 0 ? reviewChecks : undefined}
            newCardStyle={newCardStyle}
            hasBranchIdentity={Boolean(branchIdentityDisplay)}
          />
        </div>
      ) : null}

      {/* Content area */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-1.5',
          // Why: inline agent rows intentionally outdent into the card gutter; inner elements handle truncation.
          showInlineAgentList ||
            getWorkspaceAttachments(worktree).length > 1 ||
            (!newCardStyle && lineageChildren)
            ? 'overflow-visible'
            : 'overflow-hidden'
        )}
      >
        {/* Why: status glyphs and agent rows own their tooltips; only identity content opens the larger details card. */}
        <WorktreeCardIdentityHover card={card} presentation={presentation}>
          {identityContent}
        </WorktreeCardIdentityHover>
        <WorktreeCardSecondaryRows card={card} presentation={presentation} />
      </div>
    </div>
  )
}
