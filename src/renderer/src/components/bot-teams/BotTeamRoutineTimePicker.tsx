import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate } from '@/i18n/i18n'
import {
  ROUTINE_QUICK_TIMES,
  isRoutineQuickTime,
  routineTimeOptions,
  type RoutineQuickTimeKey
} from '../../../../shared/bot-team-routine-time-choices'

function quickTimeLabel(key: RoutineQuickTimeKey, time: string): string {
  switch (key) {
    case 'morning':
      return translate('components.botTeams.routineTimeMorning', 'Morning {{time}}', { time })
    case 'noon':
      return translate('components.botTeams.routineTimeNoon', 'Noon {{time}}', { time })
    case 'afternoon':
      return translate('components.botTeams.routineTimeAfternoon', 'Afternoon {{time}}', { time })
    case 'evening':
      return translate('components.botTeams.routineTimeEvening', 'Evening {{time}}', { time })
  }
}

/** Board 54: one-click times, and "Other time" for a list in 15-minute steps that also takes a typed time. */
export function BotTeamRoutineTimePicker({
  value,
  onChange
}: {
  value: string
  onChange: (time: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const other = !isRoutineQuickTime(value)
  const options = routineTimeOptions(typed)
  const choose = (time: string): void => {
    onChange(time)
    setOpen(false)
    setTyped('')
  }
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label={translate('components.botTeams.routineTime', 'Time')}
    >
      {ROUTINE_QUICK_TIMES.map((entry) => (
        <Button
          key={entry.key}
          variant={entry.time === value ? 'secondary' : 'outline'}
          size="sm"
          className="rounded-full"
          aria-pressed={entry.time === value}
          onClick={() => onChange(entry.time)}
        >
          {quickTimeLabel(entry.key, entry.time)}
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={other ? 'secondary' : 'outline'}
            size="sm"
            className="rounded-full border-dashed"
            aria-pressed={other}
          >
            {other ? value : translate('components.botTeams.routineOtherTime', 'Other time')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={translate('components.botTeams.routineTypeTime', 'Type a time')}
              value={typed}
              onValueChange={setTyped}
            />
            <CommandList>
              {options.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {translate('components.botTeams.routineNoTime', 'Not a time. Try 10:30.')}
                </p>
              ) : null}
              {options.map((time) => (
                <CommandItem key={time} value={time} onSelect={() => choose(time)}>
                  <span className="flex-1">{time}</span>
                  {time === value ? <Check className="size-3.5" aria-hidden="true" /> : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
