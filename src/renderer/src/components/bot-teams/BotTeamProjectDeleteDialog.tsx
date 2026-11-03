import { useState } from 'react'
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
import { translate } from '@/i18n/i18n'
import { deleteBotTeamProject } from '@/runtime/runtime-bot-team-project-client'
import type { BotTeamProject } from '../../../../shared/rpc-contract/bot-team-room-params'

function consequence(taskCount: number): string {
  if (taskCount === 0) {
    return translate(
      'components.botTeams.deleteProjectNoTasks',
      'It has no tasks. Files in the team folder stay.'
    )
  }
  return taskCount === 1
    ? translate(
        'components.botTeams.deleteProjectBody_one',
        'Its {{count}} task and its history are deleted. Files in the team folder stay.',
        { count: taskCount }
      )
    : translate(
        'components.botTeams.deleteProjectBody_other',
        'Its {{count}} tasks and their history are deleted. Files in the team folder stay.',
        { count: taskCount }
      )
}

/** Delete removes the project from every team that has it; only the owner team asks. */
export function BotTeamProjectDeleteDialog({
  project,
  teamId,
  taskCount,
  onClose,
  onDeleted
}: {
  project: BotTeamProject
  /** The owner team, which is the one acting. */
  teamId: string
  taskCount: number
  onClose: () => void
  onDeleted: () => void
}): React.JSX.Element {
  const [deleting, setDeleting] = useState(false)
  const remove = async (): Promise<void> => {
    setDeleting(true)
    try {
      const done = await deleteBotTeamProject({ projectId: project.id, teamId })
      if (done === 'unavailable') {
        toast.error(
          translate(
            'components.botTeams.hostCannotDeleteProject',
            'This host cannot delete projects yet.'
          )
        )
        return
      }
      onDeleted()
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
            {translate('components.botTeams.deleteProjectTitle', 'Delete {{name}}?', {
              name: project.name
            })}
          </DialogTitle>
          <DialogDescription>{consequence(taskCount)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
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
