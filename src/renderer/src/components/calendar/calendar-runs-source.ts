import type { Automation } from '../../../../shared/automations-types'
import { expandAutomationRuns } from './calendar-automation-runs'
import type { CalendarRange, CalendarRun } from './calendar-types'

export type LoadBotRuns = (range: CalendarRange) => Promise<CalendarRun[] | 'unavailable'>

/** Bot routine runs and automation runs in the window, in time order. */
export async function loadCalendarRuns(
  range: CalendarRange,
  automations: readonly Automation[],
  loadBotRuns: LoadBotRuns
): Promise<CalendarRun[]> {
  const botRuns = await loadBotRuns(range).catch((): 'unavailable' => 'unavailable')
  const runs = [...expandAutomationRuns(automations, range)]
  if (botRuns !== 'unavailable') {
    runs.push(...botRuns.filter((run) => run.at >= range.from && run.at < range.to))
  }
  return runs.sort((a, b) => a.at - b.at)
}

/** A run whose time has passed is done; the grid hides it unless the filter shows done runs. */
export function dropDoneRuns(runs: readonly CalendarRun[], now: number): CalendarRun[] {
  return runs.filter((run) => run.at >= now)
}

/** The start of the first run at or after `now`, from either source; null when none is left. */
export function nextRunStartAfter(runs: readonly CalendarRun[], now: number): number | null {
  let next: number | null = null
  for (const run of runs) {
    if (run.at >= now && (next === null || run.at < next)) {
      next = run.at
    }
  }
  return next
}
