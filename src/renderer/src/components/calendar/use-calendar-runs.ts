import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { AUTOMATIONS_CHANGED_EVENT } from '@/lib/automations-changed-window-event'
import { installWindowVisibilityInterval } from '@/lib/window-visibility-interval'
import type { Automation } from '../../../../shared/automations-types'
import { calendarAutomationTargets, listCalendarAutomations } from './calendar-automation-runs'
import { loadBotRuns } from './calendar-bot-runs-source'
import { loadCalendarRuns, nextRunStartAfter, type LoadBotRuns } from './calendar-runs-source'
import type { CalendarRange, CalendarRun } from './calendar-types'

const MINUTE_MS = 60 * 1000
// setTimeout's longest delay; a later start re-arms when this one fires.
const MAX_TIMER_MS = 2_147_483_647

/** Wall-clock time for the page, refreshed each minute while the window is visible. */
export function useCalendarNow(initialNow?: number): [number, () => void] {
  const [now, setNow] = useState(() => initialNow ?? Date.now())
  const refreshNow = useCallback(() => setNow(Date.now()), [])
  useEffect(() => {
    if (initialNow !== undefined) {
      return
    }
    return installWindowVisibilityInterval({ run: refreshNow, intervalMs: MINUTE_MS })
  }, [initialNow, refreshNow])
  return [now, refreshNow]
}

function useCalendarAutomations(): Automation[] {
  const environmentId = useAppStore((s) => s.settings?.activeRuntimeEnvironmentId ?? null)
  const [automations, setAutomations] = useState<Automation[]>([])
  useEffect(() => {
    let current = true
    const reload = (): void => {
      void listCalendarAutomations(
        calendarAutomationTargets({ activeRuntimeEnvironmentId: environmentId })
      ).then((listed) => {
        if (current) {
          setAutomations(listed)
        }
      })
    }
    reload()
    window.addEventListener(AUTOMATIONS_CHANGED_EVENT, reload)
    return () => {
      current = false
      window.removeEventListener(AUTOMATIONS_CHANGED_EVENT, reload)
    }
  }, [environmentId])
  return automations
}

type RunSnapshot = { runs: CalendarRun[]; upcomingRuns: CalendarRun[] }
const NO_RUNS: RunSnapshot = { runs: [], upcomingRuns: [] }

/**
 * Runs in the visible and upcoming windows, loaded together so both views change in one render.
 * `onRunStart` fires the moment the next run starts, so a started run turns over on time. Only the
 * visible window asks for runs that already started, since Upcoming never shows them.
 */
export function useCalendarRuns(
  visible: CalendarRange,
  upcoming: CalendarRange | null,
  options: { now: number; includeDoneRuns: boolean; onRunStart?: () => void }
): RunSnapshot {
  const { now, includeDoneRuns, onRunStart } = options
  const automations = useCalendarAutomations()
  const [snapshot, setSnapshot] = useState<RunSnapshot>(NO_RUNS)
  const visibleFrom = visible.from
  const visibleTo = visible.to
  const upcomingFrom = upcoming?.from
  const upcomingTo = upcoming?.to
  useEffect(() => {
    let current = true
    const loadVisibleRuns: LoadBotRuns = (range) =>
      loadBotRuns(range, { includePast: includeDoneRuns })
    const upcomingWindow =
      upcomingFrom === undefined || upcomingTo === undefined
        ? null
        : { from: upcomingFrom, to: upcomingTo }
    void Promise.all([
      loadCalendarRuns({ from: visibleFrom, to: visibleTo }, automations, loadVisibleRuns),
      upcomingWindow ? loadCalendarRuns(upcomingWindow, automations, loadBotRuns) : []
    ]).then(([runs, upcomingRuns]) => {
      if (current) {
        setSnapshot({ runs, upcomingRuns })
      }
    })
    return () => {
      current = false
    }
  }, [visibleFrom, visibleTo, upcomingFrom, upcomingTo, automations, includeDoneRuns])

  const nextStartAt = nextRunStartAfter([...snapshot.runs, ...snapshot.upcomingRuns], now)
  useEffect(() => {
    if (nextStartAt === null || onRunStart === undefined) {
      return
    }
    // The real clock, not `now`: a minute tick can be old while a load was in flight.
    // One millisecond past the start, so the run has started when the page reads the clock.
    const delay = Math.min(Math.max(nextStartAt - Date.now() + 1, 0), MAX_TIMER_MS)
    const timer = window.setTimeout(onRunStart, delay)
    return () => window.clearTimeout(timer)
  }, [nextStartAt, now, onRunStart])

  return snapshot
}
