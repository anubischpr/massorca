import React from 'react'
import { GitMerge } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { GitConflictOperation } from '../../../../shared/git-status-types'
import { CONFLICT_OPERATION_LABELS } from './WorktreeCardHelpers'

/** The in-progress merge/cherry-pick/rebase chip shared by every card layout. */
export function WorktreeConflictOperationBadge({
  operation
}: {
  operation: GitConflictOperation
}): React.JSX.Element | null {
  if (operation === 'unknown') {
    return null
  }
  return (
    <Badge
      variant="outline"
      className="h-[16px] px-1.5 text-[10px] font-medium rounded shrink-0 gap-1 text-amber-600 border-amber-500/30 bg-amber-500/5 dark:text-amber-400 dark:border-amber-400/30 dark:bg-amber-400/5 leading-none"
    >
      <GitMerge className="size-2.5" />
      {CONFLICT_OPERATION_LABELS[operation]}
    </Badge>
  )
}
