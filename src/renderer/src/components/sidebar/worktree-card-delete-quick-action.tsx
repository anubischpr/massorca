import React from 'react'
import { Trash2 } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'

/** The hover-revealed delete button shared by every card layout. */
export function WorktreeDeleteQuickAction({
  onPointerDown,
  onClick
}: {
  onPointerDown: React.PointerEventHandler<HTMLButtonElement>
  onClick: React.MouseEventHandler<HTMLButtonElement>
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-workspace-board-preserve-open=""
          onPointerDown={onPointerDown}
          onClick={onClick}
          className={cn(
            'inline-flex size-4 items-center justify-center rounded bg-transparent opacity-0 transition-colors transition-opacity',
            'group-hover/worktree-card:opacity-100 group-focus-within/worktree-card:opacity-100 focus-visible:opacity-100',
            'text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive'
          )}
          aria-label={translate(
            'auto.components.sidebar.WorktreeCard.6f09f58541',
            'Delete workspace'
          )}
        >
          <Trash2 className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {translate('auto.components.sidebar.WorktreeCard.6f09f58541', 'Delete workspace')}
      </TooltipContent>
    </Tooltip>
  )
}
