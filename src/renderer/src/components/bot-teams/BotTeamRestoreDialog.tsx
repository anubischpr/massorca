import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'

/** Asks before a version replaces the file; the current state is saved first either way. */
export function BotTeamRestoreDialog({
  busy,
  onCancel,
  onRestore
}: {
  busy: boolean
  onCancel: () => void
  onRestore: () => void
}): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {translate('components.botTeams.restoreTitle', 'Restore this version?')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'components.botTeams.restoreHelp',
              'The current version stays in the list, so you can go back to it.'
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            {translate('components.botTeams.cancel', 'Cancel')}
          </Button>
          <Button disabled={busy} onClick={onRestore}>
            {translate('components.botTeams.restore', 'Restore')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
