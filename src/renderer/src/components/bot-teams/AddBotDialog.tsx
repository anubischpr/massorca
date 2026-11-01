import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AgentIcon } from '@/lib/agent-catalog'
import { translate } from '@/i18n/i18n'
import { BOT_AGENT_CHOICES, type BotAgentId } from '../../../../shared/bot-team-character-art'
import type { BotDraftInput } from '../../../../shared/rpc-contract/bot-team-params'

export function AddBotDialog({
  onCancel,
  onAdd
}: {
  onCancel: () => void
  onAdd: (bot: BotDraftInput) => void
}): React.JSX.Element {
  const [name, setName] = useState('')
  const [job, setJob] = useState('')
  const [agent, setAgent] = useState<BotAgentId>(BOT_AGENT_CHOICES[0].id)
  const trimmedName = name.trim()

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{translate('components.botTeams.addBot', 'Add a bot')}</DialogTitle>
          <DialogDescription>
            {translate(
              'components.botTeams.addBotHelp',
              'This bot keeps its name and job between tasks.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bot-name">{translate('components.botTeams.botName', 'Name')}</Label>
          <Input id="bot-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bot-job">{translate('components.botTeams.botJob', 'Job')}</Label>
          <Input id="bot-job" value={job} onChange={(event) => setJob(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{translate('components.botTeams.botAgent', 'Powered by')}</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={agent}
            onValueChange={(next) => {
              const choice = BOT_AGENT_CHOICES.find((c) => c.id === next)
              if (choice) {
                setAgent(choice.id)
              }
            }}
          >
            {BOT_AGENT_CHOICES.map((choice) => (
              <ToggleGroupItem key={choice.id} value={choice.id}>
                <AgentIcon agent={choice.id} size={14} />
                {choice.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {translate('components.botTeams.cancel', 'Cancel')}
          </Button>
          <Button
            disabled={trimmedName === ''}
            onClick={() => onAdd({ name: trimmedName, job: job.trim(), agent })}
          >
            {translate('components.botTeams.addBotConfirm', 'Add bot')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
