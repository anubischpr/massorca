import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { PrototypeListRow } from '../../../../shared/prototype-list-model'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeSetRow } from './PrototypeSetRow'
import {
  prototypeArchivedHeading,
  prototypeDeleteCancelLabel,
  prototypeDeleteDialogBody,
  prototypeDeleteDialogTitle,
  prototypeDeleteLabel
} from './prototype-labels'

/** What the list needs to archive, unarchive and delete sets; absent, the list offers none of them. */
export type PrototypeArchiveControls = {
  /** The Archived group's rows, newest first. */
  rows: readonly PrototypeListRow[]
  /** False for a set whose host predates archiving, so its actions are not offered. */
  supports: (set: PrototypeListedSet) => boolean
  onArchive: (set: PrototypeListedSet) => void
  onUnarchive: (set: PrototypeListedSet) => void
  /** Opens the delete confirmation for a row. */
  onRequestDelete: (row: PrototypeListRow) => void
}

/** The tree's one open row menu: the request id whose "⋯" menu is open, or null. */
export type PrototypeRowMenuState = {
  openMenuRequestId: string | null
  onOpenMenuChange: (requestId: string | null) => void
}

/** Open-state handler of one row's menu, so opening it closes any other row's menu. */
export function rowMenuProps(
  menu: PrototypeRowMenuState,
  requestId: string
): { menuOpen: boolean; onMenuOpenChange: (open: boolean) => void } {
  return {
    menuOpen: menu.openMenuRequestId === requestId,
    onMenuOpenChange: (open) => {
      if (open) {
        menu.onOpenMenuChange(requestId)
      } else if (menu.openMenuRequestId === requestId) {
        menu.onOpenMenuChange(null)
      }
    }
  }
}

/** The end of the Prototypes tree: archived sets under a heading with their count, collapsed until it is opened. */
export function PrototypeArchivedGroup({
  controls,
  menu,
  selectedRequestId,
  onSelect
}: {
  controls: PrototypeArchiveControls
  menu: PrototypeRowMenuState
  selectedRequestId: string | null
  onSelect: (requestId: string) => void
}): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  if (controls.rows.length === 0) {
    return null
  }
  const Chevron = expanded ? ChevronDown : ChevronRight
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
        className="flex items-center gap-1 px-1.5 pt-3 pb-1.5 text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
      >
        <Chevron className="size-3" aria-hidden="true" />
        {prototypeArchivedHeading()}
        <span className="font-normal">{controls.rows.length}</span>
      </button>
      {expanded
        ? controls.rows.map((row) => (
            <PrototypeSetRow
              key={row.set.requestId}
              row={row}
              selected={row.set.requestId === selectedRequestId}
              onSelect={() => onSelect(row.set.requestId)}
              {...rowMenuProps(menu, row.set.requestId)}
              actions={{
                onUnarchive: () => controls.onUnarchive(row.set),
                ...(row.set.deletable === true && controls.supports(row.set)
                  ? { onDelete: () => controls.onRequestDelete(row) }
                  : {})
              }}
            />
          ))
        : null}
    </div>
  )
}

/** Asks before deleting one set; the set's files are removed from the host only on Delete. */
export function PrototypeDeleteDialog({
  deleting,
  onCancel,
  onDelete
}: {
  deleting: PrototypeListRow | null
  onCancel: () => void
  onDelete: (set: PrototypeListedSet) => void
}): React.JSX.Element {
  return (
    <Dialog open={deleting !== null} onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{prototypeDeleteDialogTitle()}</DialogTitle>
          <DialogDescription>{prototypeDeleteDialogBody(deleting?.title ?? '')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {prototypeDeleteCancelLabel()}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (deleting !== null) {
                onDelete(deleting.set)
              }
              onCancel()
            }}
          >
            {prototypeDeleteLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
