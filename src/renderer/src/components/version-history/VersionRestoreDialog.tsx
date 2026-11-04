import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

/** Asks before a version replaces the current one; the current version stays in the list either way. */
export function VersionRestoreDialog({
  busy,
  title,
  description,
  cancelLabel,
  restoreLabel,
  onCancel,
  onRestore
}: {
  busy: boolean
  title: string
  description: string
  cancelLabel: string
  restoreLabel: string
  onCancel: () => void
  onRestore: () => void
}): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button disabled={busy} onClick={onRestore}>
            {restoreLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
