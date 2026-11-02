import {
  latestAutomationOccurrenceAtOrBefore,
  nextAutomationOccurrenceAfter
} from './automation-schedule-occurrences'

export const BOT_TEAM_ROUTINE_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const
export type BotTeamRoutineFrequency = (typeof BOT_TEAM_ROUTINE_FREQUENCIES)[number]

/** One run time on the host's clock. `weekday` follows cron: 0 is Sunday. A month day stops at 28 so no month skips it. */
export type BotTeamRoutineSchedule = {
  frequency: BotTeamRoutineFrequency
  /** 24-hour `HH:MM`. */
  time: string
  weekday: number | null
  monthDay: number | null
}

export const BOT_TEAM_ROUTINE_MAX_MONTH_DAY = 28

/** The schedule as the cron line the Automations scheduler already understands. */
export function routineCron({
  frequency,
  time,
  weekday,
  monthDay
}: BotTeamRoutineSchedule): string {
  const [hour, minute] = time.split(':').map(Number)
  if (frequency === 'weekly') {
    return `${minute} ${hour} * * ${weekday ?? 1}`
  }
  if (frequency === 'monthly') {
    return `${minute} ${hour} ${monthDay ?? 1} * *`
  }
  return `${minute} ${hour} * * *`
}

export function nextRoutineRunAfter(schedule: BotTeamRoutineSchedule, after: number): number {
  return nextAutomationOccurrenceAfter(routineCron(schedule), after, after)
}

/** The latest run due after `after` and not after `now`: every earlier one missed in between is dropped. */
export function latestRoutineRunAtOrBefore(
  schedule: BotTeamRoutineSchedule,
  after: number,
  now: number
): number | null {
  return latestAutomationOccurrenceAtOrBefore(routineCron(schedule), after + 1, now)
}

/** A moment as the host's clock reads it, so a viewer in another zone shows the host's time. */
export type HostWallTime = { date: string; time: string }

const two = (value: number): string => String(value).padStart(2, '0')

export function hostWallTime(timestamp: number): HostWallTime {
  const moment = new Date(timestamp)
  return {
    date: `${moment.getFullYear()}-${two(moment.getMonth() + 1)}-${two(moment.getDate())}`,
    time: `${two(moment.getHours())}:${two(moment.getMinutes())}`
  }
}
