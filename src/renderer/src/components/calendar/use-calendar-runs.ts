import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { AUTOMATIONS_CHANGED_EVENT } from '@/lib/automations-changed-window-event'
import { installWindowVisibilityInterval } from '@/lib/window-visibility-interval'
import type { Automation } from '../../../../shared/automations-types'
import { calendarAutomationTargets, listCalendarAutomations } from './calendar-automation-runs'
import { loadBotRuns } from './calendar-bot-runs-source'
import { loadCalendarRuns } from './calendar-runs-source'
import type { CalendarRange, CalendarRun } from './calendar-types'

const MINUTE_MS = 60 * 1000

/** Wall-clock time for the page, refreshed each minute while the window is visible. */
export function useCalendarNow(initialNow?: number): number {
  const [now, setNow] = useState(() => initialNow ?? Date.now())
  useEffect(() => {
    if (initialNow !== undefined) {
      return
    }
    return installWindowVisibilityInterval({ run: () => setNow(Date.now()), intervalMs: MINUTE_MS })
  }, [initialNow])
  return now
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

function useRunsInRange(range: CalendarRange | null, automations: Automation[]): CalendarRun[] {
  const [runs, setRuns] = useState<CalendarRun[]>([])
  const from = range?.from
  const to = range?.to
  useEffect(() => {
    if (from === undefined || to === undefined) {
      setRuns([])
      return
    }
    let current = true
    void loadCalendarRuns({ from, to }, automations, loadBotRuns).then((loaded) => {
      if (current) {
        setRuns(loaded)
      }
    })
    return () => {
      current = false
    }
  }, [from, to, automations])
  return runs
}

/** Runs in the visible window, and in the upcoming window when one is given. */
export function useCalendarRuns(
  visible: CalendarRange,
  upcoming: CalendarRange | null
): { runs: CalendarRun[]; upcomingRuns: CalendarRun[] } {
  const automations = useCalendarAutomations()
  return {
    runs: useRunsInRange(visible, automations),
    upcomingRuns: useRunsInRange(upcoming, automations)
  }
}
