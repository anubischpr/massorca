import { useMemo, useState } from 'react'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { getAgentDisplayLabel } from '@/lib/agent-catalog'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import { useBotTeams } from '../bot-teams/use-bot-teams'
import { CalendarDayRows, CalendarMonthGrid, CalendarWeekGrid } from './CalendarGrids'
import { CalendarHeader } from './CalendarHeader'
import { CalendarLegend } from './CalendarLegend'
import { CalendarUpcomingRuns, type UpcomingRunRow } from './CalendarUpcomingRuns'
import { formatCalendarTitle, formatUpcomingWhen } from './calendar-format'
import { calendarFrequencyLabel } from './calendar-frequency-label'
import {
  addCalendarDays,
  calendarRange,
  shiftCalendarAnchor,
  startOfCalendarDay
} from './calendar-range'
import { describeCalendarRuns, type CalendarRunDisplayContext } from './calendar-run-display'
import type { CalendarView } from './calendar-types'
import { useCalendarNow, useCalendarRuns } from './use-calendar-runs'

const UPCOMING_DAYS = 8
const UPCOMING_LIMIT = 5

/** The rail's Calendar page (boards 13-15): bot team routine runs and Orca automations by day, week or month. */
export default function CalendarPage({ initialNow }: { initialNow?: number }): React.JSX.Element {
  const now = useCalendarNow(initialNow)
  const [view, setView] = useState<CalendarView>('week')
  const [anchor, setAnchor] = useState(now)
  const locale = getIntlLocale()
  const range = useMemo(() => calendarRange(view, anchor), [view, anchor])
  const today = startOfCalendarDay(now)
  const upcomingRange = useMemo(
    () => (view === 'month' ? null : { from: today, to: addCalendarDays(today, UPCOMING_DAYS) }),
    [view, today]
  )
  const { runs, upcomingRuns } = useCalendarRuns(range, upcomingRange)
  const teams = useBotTeams().teams ?? []
  const piRuntime = usePiDisplayRuntime()
  const automationsLabel = translate('auto.components.sidebar.SidebarNav.f323383e9a', 'Automations')
  const context: CalendarRunDisplayContext = {
    teams,
    agentLabel: (agent) => getAgentDisplayLabel(agent, piRuntime),
    automationsLabel,
    now,
    locale
  }
  const displays = describeCalendarRuns(runs, context)
  const upcomingRows: UpcomingRunRow[] = describeCalendarRuns(
    upcomingRuns.filter((run) => run.at >= now).slice(0, UPCOMING_LIMIT),
    context
  ).map((display) => ({
    display,
    line: [
      formatUpcomingWhen(display.run.at, now, locale, {
        today: (time) => translate('components.calendar.todayAt', 'Today at {{time}}', { time }),
        tomorrow: (time) =>
          translate('components.calendar.tomorrowAt', 'Tomorrow at {{time}}', { time }),
        other: (day, time) =>
          translate('components.calendar.dayAt', '{{day}} at {{time}}', { day, time })
      }),
      calendarFrequencyLabel(display.run.frequency),
      display.who
    ]
      .filter(Boolean)
      .join(' · ')
  }))
  const gridProps = { anchor, now, locale, displays }

  return (
    <div className="scrollbar-sleek flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-chat-canvas">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-6 py-8">
        <CalendarHeader
          title={formatCalendarTitle(view, anchor, locale)}
          view={view}
          onViewChange={setView}
          onPrevious={() => setAnchor((current) => shiftCalendarAnchor(view, current, -1))}
          onToday={() => setAnchor(now)}
          onNext={() => setAnchor((current) => shiftCalendarAnchor(view, current, 1))}
        />
        <CalendarLegend teams={teams} automationsLabel={automationsLabel} />
        {view === 'week' ? <CalendarWeekGrid {...gridProps} /> : null}
        {view === 'day' ? <CalendarDayRows {...gridProps} /> : null}
        {view === 'month' ? <CalendarMonthGrid {...gridProps} /> : null}
        {view === 'month' ? null : <CalendarUpcomingRuns rows={upcomingRows} />}
      </div>
    </div>
  )
}
