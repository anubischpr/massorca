import { CalendarRunChip, CalendarRunIcon } from './CalendarRunChip'
import { formatCalendarTime, formatCalendarWeekday } from './calendar-format'
import {
  calendarWeekDays,
  dayHourRows,
  monthGridDays,
  startOfCalendarDay
} from './calendar-range'
import type { CalendarRunDisplay } from './calendar-run-display'

type GridProps = {
  anchor: number
  now: number
  locale: string
  displays: readonly CalendarRunDisplay[]
}

function displaysOnDay(displays: readonly CalendarRunDisplay[], day: number): CalendarRunDisplay[] {
  const from = startOfCalendarDay(day)
  return displays.filter((display) => startOfCalendarDay(display.run.at) === from)
}

/** Board 13: seven day columns, today outlined in the ring color. */
export function CalendarWeekGrid({ anchor, now, locale, displays }: GridProps): React.JSX.Element {
  const today = startOfCalendarDay(now)
  return (
    <div className="grid grid-cols-7 gap-2">
      {calendarWeekDays(anchor).map((day) => (
        <div
          key={day}
          data-calendar-day={day}
          data-today={day === today}
          className="flex min-h-[188px] min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5 data-[today=true]:border-ring"
        >
          <div className="pb-0.5 text-[13px] text-muted-foreground">
            {formatCalendarWeekday(day, locale)}
            <b className="ml-1 font-semibold text-foreground">{new Date(day).getDate()}</b>
          </div>
          {displaysOnDay(displays, day).map((display) => (
            <CalendarRunChip key={display.run.id} display={display} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Board 14: two-hour rows for the day, each with its runs side by side. */
export function CalendarDayRows({ anchor, locale, displays }: GridProps): React.JSX.Element {
  const byId = new Map(displays.map((display) => [display.run.id, display]))
  const rows = dayHourRows(
    displays.map((display) => display.run),
    anchor
  )
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {rows.map((row) => (
        <div
          key={row.at}
          className="flex min-h-[46px] gap-3 border-t border-border px-4 py-1.5 text-xs first:border-t-0"
        >
          <span className="w-16 shrink-0 text-muted-foreground">
            {formatCalendarTime(row.at, locale)}
          </span>
          {row.runs.map((run) => {
            const display = byId.get(run.id)
            return display ? <CalendarRunChip key={run.id} display={display} grow /> : null
          })}
        </div>
      ))}
    </div>
  )
}

/** Board 15: whole weeks around the month; other months' days are dimmed. */
export function CalendarMonthGrid({ anchor, now, displays }: GridProps): React.JSX.Element {
  const today = startOfCalendarDay(now)
  return (
    <div className="grid grid-cols-7 gap-1">
      {monthGridDays(anchor).map(({ day, inMonth }) => (
        <div
          key={day}
          data-calendar-day={day}
          data-out={!inMonth}
          data-today={day === today}
          className="flex min-h-[98px] min-w-0 flex-col gap-[3px] rounded-md border border-border bg-card px-2 py-1.5 text-xs text-muted-foreground data-[out=true]:opacity-45 data-[today=true]:border-ring"
        >
          <span>{new Date(day).getDate()}</span>
          {displaysOnDay(displays, day).map((display) => (
            <span
              key={display.run.id}
              className="flex items-center gap-1 overflow-hidden whitespace-nowrap text-foreground"
            >
              <CalendarRunIcon display={display} size={16} />
              <span className="truncate">{display.run.name}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
