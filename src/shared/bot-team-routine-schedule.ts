import {
  latestAutomationOccurrenceAtOrBefore,
  nextAutomationOccurrenceAfter
} from './automation-schedule-occurrences'
import {
  isKnownTimeZone,
  shiftWallDays,
  wallWeekday,
  zonedInstant,
  zonedWall,
  type ZonedWall
} from './bot-team-routine-zone'

export const BOT_TEAM_ROUTINE_FREQUENCIES = ['daily', 'weekly', 'monthly', 'once'] as const
export type BotTeamRoutineFrequency = (typeof BOT_TEAM_ROUTINE_FREQUENCIES)[number]

/**
 * One run time on the clock of `timeZone`, the zone of whoever made the routine; without one (a routine
 * from before zones), on the host's clock. `weekday` follows cron: 0 is Sunday. A month day stops at 28
 * so no month skips it.
 */
export type BotTeamRoutineSchedule = {
  frequency: BotTeamRoutineFrequency
  /** 24-hour `HH:MM`. */
  time: string
  weekday: number | null
  monthDay: number | null
  /** `YYYY-MM-DD`, used by a one-time routine only. Optional so a schedule from an older peer still reads. */
  date?: string | null
  /** IANA zone, such as "America/Bogota". Optional so a schedule from an older peer still reads. */
  timeZone?: string | null
}

export const BOT_TEAM_ROUTINE_MAX_MONTH_DAY = 28

/** The routine's zone when this runtime knows it; null means the host's clock. */
function zoneOf(schedule: BotTeamRoutineSchedule): string | null {
  return schedule.timeZone && isKnownTimeZone(schedule.timeZone) ? schedule.timeZone : null
}

function clockOf(time: string): { hour: number; minute: number } | null {
  const clock = /^(\d{2}):(\d{2})$/.exec(time)
  return clock ? { hour: Number(clock[1]), minute: Number(clock[2]) } : null
}

/** A one-time routine's moment, or null when it has no valid date. */
export function onceRoutineRunAt(schedule: BotTeamRoutineSchedule): number | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(schedule.date ?? '')
  const clock = clockOf(schedule.time)
  if (!day || !clock) {
    return null
  }
  const wall = { year: Number(day[1]), month: Number(day[2]), day: Number(day[3]), ...clock }
  if (shiftWallDays(wall, 0).day !== wall.day) {
    return null
  }
  const zone = zoneOf(schedule)
  if (zone !== null) {
    return zonedInstant(wall, zone)
  }
  return new Date(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute).getTime()
}

/** The schedule as the cron line the Automations scheduler already understands. Not for one-time routines. */
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

function runsOn(schedule: BotTeamRoutineSchedule, wall: ZonedWall): boolean {
  if (schedule.frequency === 'weekly') {
    return wallWeekday(wall) === (schedule.weekday ?? 1)
  }
  if (schedule.frequency === 'monthly') {
    return wall.day === (schedule.monthDay ?? 1)
  }
  return true
}

/** Runs of a repeating routine in its zone, walking day by day from `from`'s date; at most a year. */
function* zonedRuns(
  schedule: BotTeamRoutineSchedule,
  zone: string,
  from: number,
  direction: 1 | -1
): Generator<number> {
  const clock = clockOf(schedule.time) ?? { hour: 9, minute: 0 }
  const start = { ...zonedWall(from, zone), ...clock }
  for (let offset = 0; offset <= 370; offset++) {
    const wall = shiftWallDays(start, offset * direction)
    if (runsOn(schedule, wall)) {
      yield zonedInstant(wall, zone)
    }
  }
}

/** Null once a one-time routine's moment has passed: it never runs again. */
export function nextRoutineRunAfter(
  schedule: BotTeamRoutineSchedule,
  after: number
): number | null {
  if (schedule.frequency === 'once') {
    const at = onceRoutineRunAt(schedule)
    return at !== null && at > after ? at : null
  }
  const zone = zoneOf(schedule)
  if (zone === null) {
    return nextAutomationOccurrenceAfter(routineCron(schedule), after, after)
  }
  for (const at of zonedRuns(schedule, zone, after, 1)) {
    if (at > after) {
      return at
    }
  }
  return null
}

/** The latest run due after `after` and not after `now`: every earlier one missed in between is dropped. */
export function latestRoutineRunAtOrBefore(
  schedule: BotTeamRoutineSchedule,
  after: number,
  now: number
): number | null {
  if (schedule.frequency === 'once') {
    const at = onceRoutineRunAt(schedule)
    return at !== null && at > after && at <= now ? at : null
  }
  const zone = zoneOf(schedule)
  if (zone === null) {
    return latestAutomationOccurrenceAtOrBefore(routineCron(schedule), after + 1, now)
  }
  for (const at of zonedRuns(schedule, zone, now, -1)) {
    if (at <= after) {
      return null
    }
    if (at <= now) {
      return at
    }
  }
  return null
}

/** A moment as a clock reads it: the routine's zone, else the host's. */
export type HostWallTime = { date: string; time: string }

const two = (value: number): string => String(value).padStart(2, '0')

/** `timestamp` on the clock of `timeZone`, or on the host's clock without a known zone. */
export function hostWallTime(timestamp: number, timeZone?: string | null): HostWallTime {
  if (timeZone && isKnownTimeZone(timeZone)) {
    const wall = zonedWall(timestamp, timeZone)
    return {
      date: `${wall.year}-${two(wall.month)}-${two(wall.day)}`,
      time: `${two(wall.hour)}:${two(wall.minute)}`
    }
  }
  const moment = new Date(timestamp)
  return {
    date: `${moment.getFullYear()}-${two(moment.getMonth() + 1)}-${two(moment.getDate())}`,
    time: `${two(moment.getHours())}:${two(moment.getMinutes())}`
  }
}
