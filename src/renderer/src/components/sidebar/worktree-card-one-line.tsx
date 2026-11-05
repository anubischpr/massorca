import React from 'react'

import { WorktreeCardIdentityHover } from './worktree-card-identity-hover'
import { useWorktreeAgentExpansionState } from './worktree-card-agents-expansion-state'
import { OneLineBranchRow } from './worktree-card-one-line-branch-row'
import type { WorktreeCardPresentation } from './worktree-card-presentation'
import { WorktreeCardSecondaryRows } from './worktree-card-secondary-rows'
import type { WorktreeCardController } from './use-worktree-card-controller'

/** The one-line card: a branch row, then its session rows, then nested child workspaces. */
export function WorktreeCardOneLineContent({
  card,
  presentation
}: {
  card: WorktreeCardController
  presentation: WorktreeCardPresentation
}): React.JSX.Element {
  const { worktree, showInlineAgentList, compactInlineAgentRows } = card
  // Why: this instance only owns the fold flag; the session list owns the rest of the disclosure state.
  const { sessionsCollapsed, toggleSessionsCollapsed } = useWorktreeAgentExpansionState(worktree.id)
  const hasSessions = showInlineAgentList && compactInlineAgentRows.length > 0
  const folded = hasSessions && sessionsCollapsed

  return (
    <div className="flex w-full min-w-0 flex-col" data-worktree-card-parent-content="">
      <WorktreeCardIdentityHover card={card} presentation={presentation}>
        <div
          className="group/worktree-card w-full min-w-0"
          data-worktree-card-hover-trigger=""
          data-bot-character-zone=""
        >
          <OneLineBranchRow
            card={card}
            presentation={presentation}
            hasSessions={hasSessions}
            sessionsCollapsed={folded}
            onToggleSessions={toggleSessionsCollapsed}
          />
        </div>
      </WorktreeCardIdentityHover>
      <WorktreeCardSecondaryRows card={card} presentation={presentation} sessionsFolded={folded} />
    </div>
  )
}
