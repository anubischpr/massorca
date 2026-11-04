import { Archive, LayoutTemplate, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { joinParts } from '../../../../shared/prototype-design-system-view'
import type { PrototypeListRow } from '../../../../shared/prototype-list-model'
import {
  prototypeAgentLabel,
  prototypeArchiveLabel,
  prototypeBuiltOnLabel,
  prototypeDeleteLabel,
  prototypeSetActionsLabel,
  prototypeStatusLabel,
  prototypeUnarchiveLabel
} from './prototype-labels'

/** A set row of the Prototypes tree; its menu offers Archive when the host can archive. */
export function PrototypeSetRow({
  row,
  selected,
  onSelect,
  onArchive
}: {
  row: PrototypeListRow
  selected: boolean
  onSelect: () => void
  onArchive?: () => void
}): React.JSX.Element {
  if (onArchive === undefined) {
    return <RowButton row={row} selected={selected} onSelect={onSelect} />
  }
  return (
    <div className="group/row relative">
      <RowButton row={row} selected={selected} onSelect={onSelect} reserveAction />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={prototypeSetActionsLabel(row.title)}
            className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:bg-accent hover:text-accent-foreground data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onArchive}>
            <Archive />
            {prototypeArchiveLabel()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** A set row of the Archived group: opens like any row, with Unarchive and, when the host permits, Delete. */
export function PrototypeArchivedRow({
  row,
  selected,
  onSelect,
  onUnarchive,
  onDelete
}: {
  row: PrototypeListRow
  selected: boolean
  onSelect: () => void
  onUnarchive: () => void
  onDelete?: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <RowButton row={row} selected={selected} onSelect={onSelect} />
      <div className="flex gap-1 px-2 pb-1.5">
        <Button type="button" variant="ghost" size="xs" onClick={onUnarchive}>
          {prototypeUnarchiveLabel()}
        </Button>
        {onDelete === undefined ? null : (
          <Button type="button" variant="destructive" size="xs" onClick={onDelete}>
            {prototypeDeleteLabel()}
          </Button>
        )}
      </div>
    </div>
  )
}

// One line in the sidebar's row height: the icon, the title, and its age. The tooltip names the agent and status.
// `reserveAction`: the row's menu button sits at its right end, so the age keeps clear of it.
function RowButton({
  row,
  selected,
  onSelect,
  reserveAction = false
}: {
  row: PrototypeListRow
  selected: boolean
  onSelect: () => void
  reserveAction?: boolean
}): React.JSX.Element {
  const builtOn = row.set.builtOn
  const detail = joinParts([
    prototypeAgentLabel(row.set.agent),
    prototypeStatusLabel(row.status),
    builtOn === undefined ? null : prototypeBuiltOnLabel(builtOn)
  ])
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
        reserveAction && 'pr-8',
        selected
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <LayoutTemplate className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 flex-1 truncate">{row.title}</span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          <span className="block">{row.title}</span>
          {detail === '' ? null : <span className="block text-muted-foreground">{detail}</span>}
        </TooltipContent>
      </Tooltip>
      <span className="shrink-0 text-[11px] text-muted-foreground">{row.age}</span>
    </button>
  )
}
