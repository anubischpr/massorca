import React from 'react'
import { GitBranch } from 'lucide-react'
import { translate } from '@/i18n/i18n'

/** The branch a child session runs on, when that session lives in another worktree. */
export function CrossWorktreeBranchIcon({ branch }: { branch: string }): React.JSX.Element {
  const label = translate(
    'auto.components.sidebar.worktree.card.one.line.sessions.crossWorktreeBranch',
    'Runs on branch {{branch}}',
    { branch }
  )
  return (
    <span
      className="inline-flex shrink-0 text-muted-foreground"
      title={label}
      data-cross-worktree-branch=""
    >
      <GitBranch className="size-3.5" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  )
}
