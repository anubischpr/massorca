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
import { translate } from '@/i18n/i18n'
import { BOT_AGENT_CHOICES } from '../../../../shared/bot-team-character-art'
import { botModelSummary } from '../../../../shared/bot-team-model-options'
import type { BotDraftInput } from '../../../../shared/rpc-contract/bot-team-params'
import { BotAdvancedOptions, type BotAdvancedValue } from './BotAdvancedOptions'
import { BotAgentIcon } from './BotAgentIcon'

export function AddBotDialog({
  initial,
  onCancel,
  onAdd
}: {
  /** The bot being edited; absent when adding a new one. */
  initial?: BotDraftInput
  onCancel: () => void
  onAdd: (bot: BotDraftInput) => void
}): React.JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [job, setJob] = useState(initial?.job ?? '')
  const [agent, setAgent] = useState<BotDraftInput['agent']>(
    initial?.agent ?? BOT_AGENT_CHOICES[0].id
  )
  const [advanced, setAdvanced] = useState<BotAdvancedValue>({
    modelMode: initial?.modelMode ?? 'auto',
    model: initial?.model ?? null,
    effort: initial?.effort ?? null,
    skills: initial?.skills ?? []
  })
  const trimmedName = name.trim()
  // The host picks again on save, so what it picked before only holds while these are unchanged.
  const unchanged = initial?.agent === agent && initial.job === job.trim()
  const automaticSummary =
    unchanged && initial.modelMode === 'auto'
      ? botModelSummary({ agent, model: initial.model ?? null, effort: initial.effort ?? null })
      : null

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial
              ? translate('components.botTeams.editBot', 'Edit bot')
              : translate('components.botTeams.addBot', 'Add a bot')}
          </DialogTitle>
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
                // A model belongs to its agent, so a new agent starts automatic again.
                setAdvanced((current) => ({
                  ...current,
                  modelMode: 'auto',
                  model: null,
                  effort: null
                }))
              }
            }}
          >
            {BOT_AGENT_CHOICES.map((choice) => (
              <ToggleGroupItem key={choice.id} value={choice.id}>
                <BotAgentIcon agent={choice.id} size={14} />
                {choice.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <BotAdvancedOptions
          botName={trimmedName}
          agent={agent}
          automaticSummary={automaticSummary}
          value={advanced}
          onChange={setAdvanced}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {translate('components.botTeams.cancel', 'Cancel')}
          </Button>
          <Button
            disabled={trimmedName === ''}
            onClick={() => onAdd({ name: trimmedName, job: job.trim(), agent, ...advanced })}
          >
            {initial
              ? translate('components.botTeams.saveBot', 'Save')
              : translate('components.botTeams.addBotConfirm', 'Add bot')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
