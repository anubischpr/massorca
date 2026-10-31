import { Archive, MoreHorizontal } from 'lucide-react'
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

/** A set row of the main list; its menu offers Archive when the host can archive. */
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
            className="absolute top-2 right-1.5 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:bg-accent hover:text-accent-foreground data-[state=open]:opacity-100"
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

// `reserveAction`: the row's menu button sits in its top-right corner, so the text keeps clear of it.
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
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full flex-col gap-0.5 rounded-md p-2.5 text-left text-foreground transition-colors',
        reserveAction && 'pr-8',
        selected ? 'bg-accent' : 'hover:bg-accent/60'
      )}
    >
      <span className="flex w-full justify-between gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="min-w-0 truncate text-[13px] font-medium">{row.title}</span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {row.title}
          </TooltipContent>
        </Tooltip>
        <span className="shrink-0 text-[11px] text-muted-foreground">{row.age}</span>
      </span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="rounded border border-border px-1 font-mono text-[10px] text-foreground">
          {row.mono}
        </span>
        {prototypeAgentLabel(row.set.agent)}
      </span>
      <span className="text-xs text-muted-foreground">
        {joinParts([
          prototypeStatusLabel(row.status),
          builtOn === undefined ? null : prototypeBuiltOnLabel(builtOn)
        ])}
      </span>
    </button>
  )
}
