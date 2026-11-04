import { useState } from 'react'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { deleteBotTeamRoutine } from '@/runtime/runtime-bot-team-client-routines'
import type { BotTeamRoutine } from '../../../../shared/rpc-contract/bot-team-routine-params'

/** A routine that finished its schedule: a Once routine that already ran. */
export function isArchivedBotTeamRoutine(routine: BotTeamRoutine): boolean {
  return (
    routine.schedule.frequency === 'once' && routine.nextRun === null && routine.lastRun !== null
  )
}

/** Board 57: Delete asks first; the routine stops and its history goes. */
function DeleteRoutineDialog({
  routine,
  onClose,
  onDeleted
}: {
  routine: BotTeamRoutine
  onClose: () => void
  onDeleted: (routineId: string) => void
}): React.JSX.Element {
  const [deleting, setDeleting] = useState(false)
  const remove = async (): Promise<void> => {
    setDeleting(true)
    try {
      await deleteBotTeamRoutine(routine.id)
      onDeleted(routine.id)
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setDeleting(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent role="alertdialog" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {translate('components.botTeams.deleteRoutineTitle', 'Delete {{name}}?', {
              name: routine.name
            })}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'components.botTeams.deleteRoutineBody',
              'It stops running and its run history goes too. Tasks it already started stay on the board.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {translate('components.botTeams.cancel', 'Cancel')}
          </Button>
          <Button variant="destructive" disabled={deleting} onClick={() => void remove()}>
            {translate('components.botTeams.delete', 'Delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A routine row's three-dot menu: Edit and Delete. */
export function BotTeamRoutineMenu({
  routine,
  onEdit,
  onDeleted
}: {
  routine: BotTeamRoutine
  onEdit: (routineId: string) => void
  onDeleted: (routineId: string) => void
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={translate('components.botTeams.routineActions', 'Routine actions')}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(routine.id)}>
            <Pencil />
            {translate('components.botTeams.edit', 'Edit')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 />
            {translate('components.botTeams.delete', 'Delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming ? (
        <DeleteRoutineDialog
          routine={routine}
          onClose={() => setConfirming(false)}
          onDeleted={onDeleted}
        />
      ) : null}
    </>
  )
}
