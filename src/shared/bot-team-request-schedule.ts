import { onceRoutineRunAt, type HostWallTime } from './bot-team-routine-schedule'
import {
  isKnownTimeZone,
  shiftWallDays,
  wallWeekday,
  zonedWall,
  type ZonedWall
} from './bot-team-routine-zone'

/** The day and time, on the asking person's clock, a request asks its work to start. */
export type BotTeamScheduledMoment = HostWallTime

const DEFAULT_TIME = '09:00'
// A day alone ("para mañana, agrégalo al Todo") only files the work; asking to schedule it, or a time, sets a moment.
const SCHEDULE_WORD = /\b(?:program\w*|agend\w*|calendariz\w*|schedul\w*)\b/
// Cron's numbers: 0 is Sunday.
const WEEKDAYS: readonly (readonly string[])[] = [
  ['domingo', 'sunday'],
  ['lunes', 'monday'],
  ['martes', 'tuesday'],
  ['miercoles', 'wednesday'],
  ['jueves', 'thursday'],
  ['viernes', 'friday'],
  ['sabado', 'saturday']
]

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

const two = (value: number): string => String(value).padStart(2, '0')

type Day = { year: number; month: number; day: number }

function asWall(day: Day): ZonedWall {
  return { ...day, hour: 0, minute: 0 }
}

function dayFrom(today: Day, days: number): Day {
  return shiftWallDays(asWall(today), days)
}

const dayKey = (day: Day): number => day.year * 10_000 + day.month * 100 + day.day

/** A real calendar day, or null for one like 31 February. */
function calendarDay(year: number, month: number, day: number): Day | null {
  const shifted = shiftWallDays(asWall({ year, month, day }), 0)
  return shifted.month === month && shifted.day === day ? { year, month, day } : null
}

function writtenDate(text: string, today: Day): Day | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text)
  if (iso) {
    return calendarDay(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }
  // Day first, as Spanish writes it.
  const short = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/.exec(text)
  if (!short) {
    return null
  }
  const year = short[3] ? Number(short[3]) : today.year
  const day = calendarDay(year, Number(short[2]), Number(short[1]))
  // A date with no year that already passed is next year's.
  return day && !short[3] && dayKey(day) < dayKey(today)
    ? calendarDay(year + 1, day.month, day.day)
    : day
}

function namedDay(text: string, today: Day): Day | null {
  const written = writtenDate(text, today)
  if (written) {
    return written
  }
  if (/\bpasado manana\b|\bday after tomorrow\b/.test(text)) {
    return dayFrom(today, 2)
  }
  if (/\bmanana\b|\btomorrow\b/.test(text)) {
    return dayFrom(today, 1)
  }
  const words = new Set(text.split(/[^a-z]+/))
  const weekday = WEEKDAYS.findIndex((names) => names.some((name) => words.has(name)))
  if (weekday !== -1) {
    // The next one, never today: "on Tuesday" said on a Tuesday means next week's.
    return dayFrom(today, (weekday - wallWeekday(asWall(today)) + 7) % 7 || 7)
  }
  return /\bhoy\b|\btoday\b/.test(text) ? today : null
}

function todayIn(now: number, timeZone: string | null): Day {
  if (timeZone) {
    const { year, month, day } = zonedWall(now, timeZone)
    return { year, month, day }
  }
  const local = new Date(now)
  return { year: local.getFullYear(), month: local.getMonth() + 1, day: local.getDate() }
}

function namedTime(text: string): string | null {
  const clock =
    /\b(?:a las|a la|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la tarde|de la noche|de la manana)?\b/.exec(
      text
    ) ?? /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(text)
  if (!clock) {
    return null
  }
  let hour = Number(clock[1])
  const minute = clock[2] ? Number(clock[2]) : 0
  const half = clock[3]
  if ((half === 'pm' || half === 'de la tarde' || half === 'de la noche') && hour < 12) {
    hour += 12
  }
  if (half === 'am' && hour === 12) {
    hour = 0
  }
  return hour < 24 && minute < 60 ? `${two(hour)}:${two(minute)}` : null
}

/**
 * The moment a request names for its work, read without a model: a day (a date, tomorrow, a weekday,
 * or today with a time) and an optional time, 09:00 by default. Null without a day, without a word
 * asking to schedule it or a time, or when it is past.
 */
export function botTeamRequestScheduledMoment(
  text: string,
  now: number,
  /** The asking person's zone; the host's clock without one. */
  timeZone: string | null = null
): BotTeamScheduledMoment | null {
  const zone = timeZone && isKnownTimeZone(timeZone) ? timeZone : null
  // "Esta mañana" names the morning, not tomorrow.
  const value = plain(text).replace(/\b(?:esta|por la|en la|de la)\s+manana\b/g, (phrase) =>
    phrase.startsWith('de la') ? phrase : ' '
  )
  const day = namedDay(value, todayIn(now, zone))
  if (!day) {
    return null
  }
  const time = namedTime(value)
  if (time === null && (!SCHEDULE_WORD.test(value) || /\bhoy\b|\btoday\b/.test(value))) {
    return null
  }
  const moment = {
    date: `${day.year}-${two(day.month)}-${two(day.day)}`,
    time: time ?? DEFAULT_TIME
  }
  return isFuture(moment, now, zone) ? moment : null
}

function isFuture(moment: BotTeamScheduledMoment, now: number, timeZone: string | null): boolean {
  const at = onceRoutineRunAt({
    frequency: 'once',
    weekday: null,
    monthDay: null,
    timeZone,
    ...moment
  })
  return at !== null && at > now
}

/** The moment the classify reply's `when` names, when it is a real one still ahead. */
export function botTeamClassifyScheduledMoment(
  reply: string,
  now: number,
  timeZone: string | null = null
): BotTeamScheduledMoment | null {
  const when = /"when"\s*:\s*"(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})"/.exec(reply)
  if (!when) {
    return null
  }
  const moment = { date: when[1], time: when[2] }
  const zone = timeZone && isKnownTimeZone(timeZone) ? timeZone : null
  return isFuture(moment, now, zone) ? moment : null
}
