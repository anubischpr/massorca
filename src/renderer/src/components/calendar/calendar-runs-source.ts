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
