import { useEffect } from 'react'
import { Archive, ArchiveRestore, LayoutTemplate, MoreHorizontal, Trash2 } from 'lucide-react'
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

/** The row menu's actions; a row with none shows no menu. */
export type PrototypeSetRowActions = {
  onArchive?: () => void
  onUnarchive?: () => void
  /** Asks before deleting; offered only for a set the host lists as deletable. */
  onDelete?: () => void
}

/**
 * A set row of the Prototypes tree, active or archived, with its actions behind one "⋯" menu.
 * The tree owns the menu's open state so only one row menu is open at a time.
 */
export function PrototypeSetRow({
  row,
  selected,
  onSelect,
  actions,
  menuOpen,
  onMenuOpenChange
}: {
  row: PrototypeListRow
  selected: boolean
  onSelect: () => void
  actions: PrototypeSetRowActions
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { onArchive, onUnarchive, onDelete } = actions
  useCloseOnContextMenu(menuOpen, onMenuOpenChange)
  if (onArchive === undefined && onUnarchive === undefined && onDelete === undefined) {
    return <RowButton row={row} selected={selected} onSelect={onSelect} />
  }
  return (
    <div className="group/row relative">
      <RowButton row={row} selected={selected} onSelect={onSelect} reserveAction />
      <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
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
          {onArchive === undefined ? null : (
            <DropdownMenuItem onSelect={onArchive}>
              <Archive />
              {prototypeArchiveLabel()}
            </DropdownMenuItem>
          )}
          {onUnarchive === undefined ? null : (
            <DropdownMenuItem onSelect={onUnarchive}>
              <ArchiveRestore />
              {prototypeUnarchiveLabel()}
            </DropdownMenuItem>
          )}
          {onDelete === undefined ? null : (
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              {prototypeDeleteLabel()}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// Why: a right-click does not dismiss a Radix dropdown, so another context menu would open beside it.
function useCloseOnContextMenu(open: boolean, onOpenChange: (open: boolean) => void): void {
  useEffect(() => {
    if (!open) {
      return undefined
    }
    const close = (): void => onOpenChange(false)
    document.addEventListener('contextmenu', close, true)
    return () => document.removeEventListener('contextmenu', close, true)
  }, [open, onOpenChange])
}

// One line in the sidebar's row height: the icon, the title, and its number of prototypes. The tooltip names the agent and status.
// `reserveAction`: the row's menu button sits at its right end, so the count keeps clear of it.
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
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {row.set.directions.length}
      </span>
    </button>
  )
}
