import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import { createBotTeamRoutine } from '@/runtime/runtime-bot-team-client-routines'
import { useAppStore } from '@/store'
import {
  BOT_TEAM_ROUTINE_FREQUENCIES,
  BOT_TEAM_ROUTINE_MAX_MONTH_DAY,
  type BotTeamRoutineFrequency
} from '../../../../shared/bot-team-routine-schedule'
import type { BotTeam } from '../../../../shared/rpc-contract/bot-team-params'
import { BotAgentIcon } from './BotAgentIcon'
import { ROUTINE_WEEKDAYS, routineAccessLabel, routineWeekdayName } from './BotTeamRoutineLabels'
import { BotTeamViewHeader } from './BotTeamViewHeader'

function frequencyLabel(frequency: BotTeamRoutineFrequency): string {
  switch (frequency) {
    case 'daily':
      return translate('components.botTeams.routineEveryDayChoice', 'Every day')
    case 'weekly':
      return translate('components.botTeams.routineEveryWeekChoice', 'Every week')
    case 'monthly':
      return translate('components.botTeams.routineEveryMonthChoice', 'Every month')
  }
}

const MONTH_DAYS = Array.from({ length: BOT_TEAM_ROUTINE_MAX_MONTH_DAY }, (_, index) => index + 1)

/** New routine (board 41): what it does, when, and which bot does it. */
export function BotTeamRoutineNew({
  team,
  onBack,
  onCreated
}: {
  team: BotTeam
  onBack: () => void
  onCreated: () => void
}): React.JSX.Element {
  const openSettingsTarget = useAppStore((state) => state.openSettingsTarget)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [frequency, setFrequency] = useState<BotTeamRoutineFrequency>('weekly')
  const [time, setTime] = useState('09:00')
  const [weekday, setWeekday] = useState(1)
  const [monthDay, setMonthDay] = useState(1)
  const [botId, setBotId] = useState(team.bots[0]?.id ?? '')
  const bot = team.bots.find((entry) => entry.id === botId)
  const ready = name.trim() !== '' && prompt.trim() !== '' && time !== '' && bot !== undefined
  const create = async (): Promise<void> => {
    try {
      await createBotTeamRoutine({
        teamId: team.id,
        botId,
        name: name.trim(),
        prompt: prompt.trim(),
        schedule: {
          frequency,
          time,
          weekday: frequency === 'weekly' ? weekday : null,
          monthDay: frequency === 'monthly' ? monthDay : null
        }
      })
      onCreated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BotTeamViewHeader
        title={translate('components.botTeams.newRoutine', 'New routine')}
        detail={team.name}
        backLabel={translate('components.botTeams.routines', 'Routines')}
        onBack={onBack}
      />
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[736px] flex-col gap-5 px-4 py-8">
          <div>
            <h1 className="text-xl font-semibold">
              {translate('components.botTeams.newRoutine', 'New routine')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {translate(
                'components.botTeams.newRoutineHelp',
                'A routine starts a task on a schedule. Its bot does the work, and each run is kept in its history.'
              )}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="routine-name">
              {translate('components.botTeams.routineName', 'Name')}
            </Label>
            <Input
              id="routine-name"
              placeholder={translate('components.botTeams.routineNameExample', 'Monday check-in')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="routine-prompt">
              {translate('components.botTeams.routineWhat', 'What should it do?')}
            </Label>
            <Textarea
              id="routine-prompt"
              placeholder={translate(
                'components.botTeams.routineWhatExample',
                'List what is still open in {{team}} and post it in the Conference room.',
                { team: team.name }
              )}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{translate('components.botTeams.routineWhen', 'When')}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                type="single"
                variant="outline"
                value={frequency}
                onValueChange={(next) => {
                  const chosen = BOT_TEAM_ROUTINE_FREQUENCIES.find((entry) => entry === next)
                  if (chosen) {
                    setFrequency(chosen)
                  }
                }}
              >
                {BOT_TEAM_ROUTINE_FREQUENCIES.map((entry) => (
                  <ToggleGroupItem key={entry} value={entry}>
                    {frequencyLabel(entry)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Input
                type="time"
                className="w-28"
                aria-label={translate('components.botTeams.routineTime', 'Time')}
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </div>
            {frequency === 'weekly' ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ROUTINE_WEEKDAYS.map((day) => (
                  <Button
                    key={day}
                    variant={day === weekday ? 'secondary' : 'outline'}
                    size="xs"
                    className="rounded-full"
                    aria-pressed={day === weekday}
                    onClick={() => setWeekday(day)}
                  >
                    {routineWeekdayName(day, 'short')}
                  </Button>
                ))}
              </div>
            ) : null}
            {frequency === 'monthly' ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {MONTH_DAYS.map((day) => (
                  <Button
                    key={day}
                    variant={day === monthDay ? 'secondary' : 'outline'}
                    size="xs"
                    className="w-8 rounded-full px-0"
                    aria-pressed={day === monthDay}
                    onClick={() => setMonthDay(day)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {translate(
                'components.botTeams.routineClockHelp',
                'Runs at this time, on the clock of the host {{team}} uses.',
                { team: team.name }
              )}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{translate('components.botTeams.routineBot', 'Bot')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {team.bots.map((entry) => (
                <Button
                  key={entry.id}
                  variant={entry.id === botId ? 'secondary' : 'outline'}
                  size="sm"
                  aria-pressed={entry.id === botId}
                  onClick={() => setBotId(entry.id)}
                >
                  <BotAgentIcon agent={entry.agent} size={16} />
                  {entry.name}
                </Button>
              ))}
            </div>
            {bot?.job ? <p className="text-xs text-muted-foreground">{bot.job}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{translate('components.botTeams.routineAccess', 'Access')}</Label>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{routineAccessLabel(team)}</div>
                <div className="text-xs text-muted-foreground">
                  {translate(
                    'components.botTeams.routineAccessHelp',
                    'Set for {{team}} in Settings. This routine uses it.',
                    { team: team.name }
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSettingsTarget({ pane: 'bot-teams', repoId: null })}
              >
                {translate('components.botTeams.routineChangeInSettings', 'Change in Settings')}
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onBack}>
              {translate('components.botTeams.cancel', 'Cancel')}
            </Button>
            <Button disabled={!ready} onClick={() => void create()}>
              {translate('components.botTeams.createRoutine', 'Create routine')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
