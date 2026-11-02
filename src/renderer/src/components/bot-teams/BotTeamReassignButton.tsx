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
import { reassignBotTeamTask } from '@/runtime/runtime-bot-team-routing-client'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import type { BotTeamTask } from '../../../../shared/rpc-contract/bot-team-room-params'
import { BotAgentIcon } from './BotAgentIcon'

/** Reassign, as drawn: any bot of any team, and the new owner continues from the task so far. */
export function BotTeamReassignButton({
  task,
  teams,
  disabled,
  onDone
}: {
  task: BotTeamTask
  teams: readonly BotTeam[]
  disabled: boolean
  onDone: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const pick = async (botId: string): Promise<void> => {
    setBusy(true)
    try {
      const done = await reassignBotTeamTask(task.id, botId)
      if (done.startError) {
        toast.error(done.startError)
      }
      setOpen(false)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        {translate('components.botTeams.reassign', 'Reassign')}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {translate('components.botTeams.reassignTitle', 'Who should own {{title}}?', {
                title: task.title
              })}
            </DialogTitle>
            <DialogDescription>
              {translate(
                'components.botTeams.reassignHelp',
                'The new owner reads the task so far and continues from there.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="scrollbar-sleek flex max-h-[360px] flex-col overflow-y-auto rounded-md border border-border">
            {teams.flatMap((team) =>
              team.bots
                .filter((bot) => bot.id !== task.ownerBotId)
                .map((bot) => (
                  <button
                    key={bot.id}
                    type="button"
                    data-bot={bot.id}
                    disabled={busy}
                    className="flex items-center gap-3 px-3 py-2 text-left hover:bg-accent disabled:opacity-60"
                    onClick={() => void pick(bot.id)}
                  >
                    <BotAgentIcon agent={bot.agent} size={20} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{bot.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {bot.job ? `${team.name}, ${bot.job}` : team.name}
                      </span>
                    </span>
                  </button>
                ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              {translate('components.botTeams.cancel', 'Cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
