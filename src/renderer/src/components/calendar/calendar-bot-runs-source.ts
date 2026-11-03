import type { CalendarRange, CalendarRun } from './calendar-types'

/** One run as botTeams.listScheduledRuns returns it (Bot teams branch). */
export type BotScheduledRun = {
  routineId: string
  routineName: string
  teamId: string
  teamName: string
  botId: string
  botName: string
  botAgent: string
  projectId: string
  projectName: string
  frequency: 'daily' | 'weekly' | 'monthly'
  at: number
  hostTime: { date: string; time: string }
}

export function botScheduledRunToCalendarRun(run: BotScheduledRun): CalendarRun {
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
export async function loadBotRuns(_range: CalendarRange): Promise<CalendarRun[] | 'unavailable'> {
  // Wired to listBotTeamScheduledRuns (botTeams.listScheduledRuns, max 62 days) once the Bot teams branch lands.
  return 'unavailable'
}
