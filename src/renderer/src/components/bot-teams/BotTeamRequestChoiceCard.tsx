import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { BotTeamRequestChoice } from '../../../../shared/bot-team-request-choice'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotAgentIcon } from './BotAgentIcon'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'

type Option = { id: string; name: string; detail: string; icon: React.JSX.Element }

function options(
  choice: BotTeamRequestChoice,
  team: BotTeam,
  otherTeams: readonly BotTeam[]
): Option[] {
  if (choice.kind === 'new-bot') {
    return team.bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      detail: bot.job,
      icon: <BotAgentIcon agent={bot.agent} size={16} />
    }))
  }
  // The suggested team comes first, so it is the one picked until the person changes it.
  const suggested = choice.kind === 'other-team' ? choice.teamId : null
  return [...otherTeams]
    .sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested))
    .map((other) => ({
      id: other.id,
      name: other.name,
      detail: other.purpose,
      icon: <BotTeamCharacterIcon character={other.character} size={20} />
    }))
}

/**
 * The room's question when no bot of the team can simply take a request. Built like the Automatic
 * agent choice card for child sessions: a question, tiles to change the pick, then the actions.
 */
export function BotTeamRequestChoiceCard({
  choice,
  team,
  otherTeams,
  busy,
  onSendToBot,
  onSendToTeam,
  onKeep,
  onCreateBot,
  onCreateTeam
}: {
  choice: BotTeamRequestChoice
  team: BotTeam
  otherTeams: readonly BotTeam[]
  busy: boolean
  onSendToBot: (botId: string) => void
  onSendToTeam: (teamId: string) => void
  onKeep: () => void
  onCreateBot: () => void
  onCreateTeam: () => void
}): React.JSX.Element {
  const baseId = useId()
  const rows = options(choice, team, otherTeams)
  // The bot the host reads as closest is picked first; the first bot of the team otherwise.
  const [picked, setPicked] = useState<string | null>(
    choice.kind === 'new-bot' ? (choice.suggestedBotId ?? null) : null
  )
  const selected = rows.find((row) => row.id === picked) ?? rows.at(0) ?? null
  const name = selected?.name ?? ''
  const question =
    choice.kind === 'other-team'
      ? translate(
          'components.botTeams.choiceOtherTeam',
          'Choose where this task goes: Send to {{team}}, or keep it in {{current}}.',
          { team: name, current: team.name }
        )
      : choice.kind === 'new-bot'
        ? translate(
            'components.botTeams.choiceNewBot',
            'Choose who takes this task: create a new bot, or send it to an existing bot.'
          )
        : translate(
            'components.botTeams.choiceNewTeam',
            'Choose where this task goes: create a new team, or send it to an existing team.'
          )
  const send = (): void => {
    if (selected) {
      return choice.kind === 'new-bot' ? onSendToBot(selected.id) : onSendToTeam(selected.id)
    }
  }
  return (
    <div
      role="group"
      aria-label={question}
      aria-busy={busy}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <p className="text-sm font-semibold text-foreground">{question}</p>
      {rows.length > 0 ? (
        <RadioGroup
          aria-label={translate('components.botTeams.choiceOptions', 'Where this task can go')}
          value={selected?.id ?? ''}
          onValueChange={setPicked}
          disabled={busy}
          className="sm:grid-cols-2"
        >
          {rows.map((row, index) => (
            <label
              key={row.id}
              htmlFor={`${baseId}-${index}`}
              className={cn(
                'flex min-w-0 cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
                row.id === selected?.id
                  ? 'border-primary bg-accent'
                  : 'border-border hover:bg-accent/60',
                busy && 'cursor-default opacity-60'
              )}
            >
              <RadioGroupItem id={`${baseId}-${index}`} value={row.id} disabled={busy} />
              <span className="flex size-6 shrink-0 items-center justify-center">{row.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {row.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{row.detail}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {choice.kind === 'other-team' ? (
          <Button variant="outline" disabled={busy} onClick={onKeep}>
            {translate('components.botTeams.keepInTeam', 'Keep in {{team}}', { team: team.name })}
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={busy}
            onClick={choice.kind === 'new-bot' ? onCreateBot : onCreateTeam}
          >
            {choice.kind === 'new-bot'
              ? translate('components.botTeams.createBot', 'Create a new bot')
              : translate('components.botTeams.createTeam', 'Create a new team')}
          </Button>
        )}
        {selected ? (
          <Button disabled={busy} onClick={send}>
            {translate('components.botTeams.sendTo', 'Send to {{name}}', { name })}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
