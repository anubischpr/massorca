import React from 'react'

import { useNow } from '@/hooks/use-now'
import { useAppStore, type AppState } from '@/store'
import { findWorktreeById } from '@/store/github/worktree-refresh'
import { resolveWorktreeCardLayout } from '../../../../../../shared/constants'
import { SessionStatusGlyphIcon } from '../../SessionStatusGlyphIcon'
import { selectWorktreeAgentRowsFromState } from '../../worktree-agent-rows-from-state'
import { selectAcknowledgedAgentTimes } from '../../worktree-card-agent-ack-inputs'
import { selectWorktreeActivityStatuses } from '../../use-worktree-activity-statuses'
import {
  worstSessionStatusGlyph,
  worktreeRowGlyph,
  type SessionStatusGlyph,
  type WorktreeGlyphInput
} from '../../worktree-session-status'

const NO_WORKTREE_IDS: readonly string[] = []

/** The worst glyph among a folded project's hidden worktrees, each read from its session rows. */
export function getWorstHiddenProjectGlyph(
  worktrees: readonly WorktreeGlyphInput[]
): SessionStatusGlyph | null {
  return worstSessionStatusGlyph(worktrees.map((worktree) => worktreeRowGlyph(worktree)))
}

// Why: returns one primitive, so a header re-renders only when its glyph changes.
function selectHiddenProjectGlyph(
  state: AppState,
  worktreeIds: readonly string[],
  now: number
): SessionStatusGlyph | null {
  const statuses = selectWorktreeActivityStatuses(state, worktreeIds)
  return getWorstHiddenProjectGlyph(
    worktreeIds.map((worktreeId) => {
      // Why: this status only runs in the one-line layout, which lists cross-worktree children under their parent.
      const agents = selectWorktreeAgentRowsFromState(state, worktreeId, now, true)
      return {
        agents,
        acknowledgedAgentTimes: selectAcknowledgedAgentTimes(state, agents),
        status: statuses.get(worktreeId),
        isUnread: findWorktreeById(state, worktreeId)?.isUnread === true
      }
    })
  )
}

export function CollapsedProjectStatus({
  worktreeIds
}: {
  worktreeIds: readonly string[] | undefined
}): React.JSX.Element | null {
  const oneLine = useAppStore(
    (s) =>
      s.settings?.experimentalNewWorktreeCardStyle !== true &&
      resolveWorktreeCardLayout(s.settings) === 'one-line'
  )
  const ids = oneLine && worktreeIds ? worktreeIds : NO_WORKTREE_IDS
  // Why: a session goes quiet by the clock, so the header also re-reads on the shared 30s tick.
  const now = useNow(30_000)
  const glyph = useAppStore((s) => selectHiddenProjectGlyph(s, ids, now))
  return glyph ? (
    <span className="mr-1 flex shrink-0 items-center" data-collapsed-project-status={glyph}>
      <SessionStatusGlyphIcon glyph={glyph} />
    </span>
  ) : null
}
