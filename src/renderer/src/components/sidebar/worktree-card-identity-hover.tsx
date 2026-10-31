import React from 'react'

import { WorktreeCardDetailsHover } from './WorktreeCardMeta'
import { WorktreeCardPortsDetails } from './WorktreeCardPorts'
import type { WorktreeCardPresentation } from './worktree-card-presentation'
import type { WorktreeCardController } from './use-worktree-card-controller'

/** The details hover card around a card's identity content, shared by every layout. */
export function WorktreeCardIdentityHover({
  card,
  presentation,
  children
}: {
  card: WorktreeCardController
  presentation: WorktreeCardPresentation
  children: React.ReactElement
}): React.JSX.Element {
  const {
    worktree,
    affiliateListMode,
    titleRenaming,
    isDeleting,
    referenceDetails,
    hoverIssue,
    hoverLinearIssue,
    hoverJiraIssue,
    hoverReview,
    hoverComment,
    metaAutomationProvenance,
    metaCliProvenance,
    workspacePorts,
    detailsHoverControl,
    handleRenameTitle,
    handleEditIssue,
    handleManageLinks,
    handleEditComment,
    handleOpenGitHubIssueInOrca,
    handleOpenIssueInBrowser,
    linearIssue,
    handleOpenLinearIssueInOrca,
    handleOpenReviewInOrca,
    handleOpenReviewInBrowser,
    handleOpenAutomation,
    handleOpenAutomationRun,
    canUnlinkReview,
    handleUnlinkReview
  } = card
  const { hasHoverDetails, hoverBranchName, hoverWorkspaceTitle } = presentation
  if (!hasHoverDetails || titleRenaming) {
    return children
  }
  return (
    <WorktreeCardDetailsHover
      workspace={worktree}
      referenceDetails={referenceDetails}
      onManageLinks={affiliateListMode ? undefined : handleManageLinks}
      issue={hoverIssue}
      linearIssue={hoverLinearIssue}
      jiraIssue={hoverJiraIssue}
      review={hoverReview}
      comment={hoverComment}
      automationProvenance={metaAutomationProvenance}
      cliProvenance={metaCliProvenance}
      branchName={hoverBranchName}
      workspaceTitle={hoverWorkspaceTitle}
      workspaceTitleRenameDisabled={isDeleting || affiliateListMode}
      detailsAfter={
        workspacePorts.length > 0 ? <WorktreeCardPortsDetails ports={workspacePorts} /> : null
      }
      openDelay={100}
      hoverControl={detailsHoverControl}
      onRenameWorkspaceTitle={affiliateListMode ? undefined : handleRenameTitle}
      onEditIssue={affiliateListMode ? undefined : handleEditIssue}
      onEditComment={affiliateListMode ? undefined : handleEditComment}
      onOpenGitHubIssueInOrca={
        hoverIssue && 'url' in hoverIssue && hoverIssue.url
          ? handleOpenGitHubIssueInOrca
          : undefined
      }
      onOpenIssueInBrowser={
        hoverIssue && 'url' in hoverIssue && hoverIssue.url ? handleOpenIssueInBrowser : undefined
      }
      onOpenLinearIssueInOrca={linearIssue?.url ? handleOpenLinearIssueInOrca : undefined}
      onOpenReviewInOrca={
        hoverReview?.url && hoverReview.provider === 'github' ? handleOpenReviewInOrca : undefined
      }
      onOpenReviewInBrowser={hoverReview?.url ? handleOpenReviewInBrowser : undefined}
      onOpenAutomation={affiliateListMode ? undefined : handleOpenAutomation}
      onOpenAutomationRun={affiliateListMode ? undefined : handleOpenAutomationRun}
      onUnlinkReview={!affiliateListMode && canUnlinkReview ? handleUnlinkReview : undefined}
    >
      {children}
    </WorktreeCardDetailsHover>
  )
}
