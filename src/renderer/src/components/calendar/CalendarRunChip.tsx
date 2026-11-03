import { CalendarClock } from 'lucide-react'
import { BotTeamCharacterIcon } from '../bot-teams/BotTeamCharacterIcon'
import type { CalendarRunDisplay } from './calendar-run-display'

/** The team's character, or the Automations icon; nothing for a team this host does not know. */
export function CalendarRunIcon({
  display,
  size
}: {
  display: Pick<CalendarRunDisplay, 'run' | 'character'>
  size: 16 | 20 | 28
}): React.JSX.Element | null {
  if (display.run.source === 'automation') {
    return (
      <CalendarClock
        aria-hidden
        data-size={size}
        className="shrink-0 text-muted-foreground data-[size=16]:size-4 data-[size=20]:size-5 data-[size=28]:size-7"
      />
    )
  }
  return display.character ? (
    <span aria-hidden className="flex shrink-0">
      <BotTeamCharacterIcon character={display.character} size={size} still />
    </span>
  ) : null
}

/** Upcoming runs are green; runs already past wear the ring color, as on the boards. */
export function CalendarRunDot({ past }: { past: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden
      data-past={past}
      className="size-2 shrink-0 rounded-full bg-status-success data-[past=true]:bg-ring"
    />
  )
}

/** Week and Day chip: time, status dot and team icon, then the run name, then "bot · team". */
export function CalendarRunChip({
  display,
  grow = false
}: {
  display: CalendarRunDisplay
  grow?: boolean
}): React.JSX.Element {
  return (
    <div
      data-calendar-run={display.run.id}
      data-grow={grow}
      className="flex min-w-0 flex-col gap-0.5 rounded-md bg-muted px-2 py-1.5 text-xs data-[grow=true]:flex-1"
    >
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <CalendarRunDot past={display.past} />
        {display.time}
        <span className="flex-1" />
        <CalendarRunIcon display={display} size={20} />
      </span>
      <span className="truncate">{display.run.name}</span>
      {display.who ? (
        <span className="truncate text-muted-foreground">{display.who}</span>
      ) : null}
    </div>
  )
}
