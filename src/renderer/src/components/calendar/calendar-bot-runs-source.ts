import { listBotTeamScheduledRuns } from '@/runtime/runtime-bot-team-client-routines'
import type { BotTeamScheduledRun } from '../../../../shared/rpc-contract/bot-team-scheduled-run-params'
import type { CalendarRange, CalendarRun } from './calendar-types'

/** The host lists at most 62 days per call. */
export const BOT_RUNS_MAX_WINDOW_MS = 62 * 24 * 60 * 60 * 1000

export function botScheduledRunToCalendarRun(run: BotTeamScheduledRun): CalendarRun {
  return {
    id: `bot:${run.routineId}:${run.at}`,
    name: run.routineName,
    at: run.at,
    frequency: run.frequency,
    source: 'bot',
    botName: run.botName,
    teamId: run.teamId,
    teamName: run.teamName
  }
}

/** Bot team routine runs in the window, or 'unavailable' when the host cannot list them. */
export async function loadBotRuns(range: CalendarRange): Promise<CalendarRun[] | 'unavailable'> {
  const runs: CalendarRun[] = []
  for (let from = range.from; from < range.to; from += BOT_RUNS_MAX_WINDOW_MS) {
    const to = Math.min(range.to, from + BOT_RUNS_MAX_WINDOW_MS)
    const result = await listBotTeamScheduledRuns({ from, to })
    if (result === 'unavailable') {
      return 'unavailable'
    }
    runs.push(...result.runs.map(botScheduledRunToCalendarRun))
  }
  return runs
}
