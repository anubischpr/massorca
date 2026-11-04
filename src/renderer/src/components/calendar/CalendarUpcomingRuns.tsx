import { translate } from '@/i18n/i18n'
import { CalendarRunDot, CalendarRunIcon } from './CalendarRunChip'
import type { CalendarRunDisplay } from './calendar-run-display'

export type UpcomingRunRow = { display: CalendarRunDisplay; line: string }

/** Below Day and Week: the next runs, each as "when · frequency · bot · team". Hidden when none. */
export function CalendarUpcomingRuns({
  rows
}: {
  rows: readonly UpcomingRunRow[]
}): React.JSX.Element | null {
  if (rows.length === 0) {
    return null
  }
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">
        {translate('components.calendar.upcoming', 'Upcoming runs')}
      </h2>
      <div className="rounded-xl border border-border bg-card">
        {rows.map(({ display, line }) => (
          <div
            key={display.run.id}
            className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
          >
            <CalendarRunDot past={false} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{display.run.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{line}</span>
            </span>
            <CalendarRunIcon display={display} size={28} />
          </div>
        ))}
      </div>
    </section>
  )
}
