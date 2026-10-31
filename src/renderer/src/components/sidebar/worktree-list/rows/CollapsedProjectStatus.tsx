import React from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/github/worktree-refresh'
import { resolveWorktreeCardLayout } from '../../../../../../shared/constants'
import { SessionStatusGlyphIcon } from '../../SessionStatusGlyphIcon'
import { useWorktreeActivityStatuses } from '../../use-worktree-activity-statuses'
import {
  worktreeStatusGlyph,
  worstSessionStatusGlyph,
  type SessionStatusGlyph
} from '../../worktree-session-status'
import type { WorktreeStatus } from '@/lib/worktree-status'

const NO_WORKTREE_IDS: readonly string[] = []

/** The worst status among a folded project's hidden worktrees, from the same store the cards read. */
export function getWorstHiddenProjectGlyph(
  worktreeIds: readonly string[],
  statuses: ReadonlyMap<string, WorktreeStatus>,
  unreadIds: ReadonlySet<string>
): SessionStatusGlyph | null {
  return worstSessionStatusGlyph(
    worktreeIds.map((id) => {
      const status = statuses.get(id)
      return status ? worktreeStatusGlyph(status, unreadIds.has(id)) : null
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
  const statuses = useWorktreeActivityStatuses(ids)
  const unread = useAppStore(
    useShallow((s) => ids.filter((id) => findWorktreeById(s, id)?.isUnread === true))
  )
  const glyph = getWorstHiddenProjectGlyph(ids, statuses, new Set(unread))
  return glyph ? (
    <span className="mr-1 flex shrink-0 items-center" data-collapsed-project-status={glyph}>
      <SessionStatusGlyphIcon glyph={glyph} />
    </span>
  ) : null
}
