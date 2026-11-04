import { hostWallTime } from './bot-team-routine-schedule'
import { isKnownTimeZone, localTimeZone } from './bot-team-routine-zone'

// Opens the paragraph a task's start notes carry, so it can be found again.
const CLOCK_LEAD = "The person's clock when they asked:"

function knownZone(timeZone: string | null | undefined): string | null {
  return timeZone && isKnownTimeZone(timeZone) ? timeZone : null
}

/**
 * `now` on a clock as a prompt reads it, such as "Tuesday 2026-11-03 23:38 America/Lima". Without a
 * known zone it reads the host's clock and names the host's zone.
 */
export function botTeamClockLine(now: number, timeZone?: string | null): string {
  const zone = knownZone(timeZone)
  const wall = hostWallTime(now, zone)
  const weekday = new Date(now).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: zone ?? undefined
  })
  const name = zone ?? localTimeZone()
  const line = `${weekday} ${wall.date} ${wall.time}`
  return name ? `${line} ${name}` : line
}

/**
 * The person's clock as a sentence a prompt carries: a bot reads "today", "tomorrow" and weekdays on
 * it, never on the host's clock. Null without a known zone, since then there is no person's clock.
 */
export function botTeamClockNote(now: number, timeZone?: string | null): string | null {
  const zone = knownZone(timeZone)
  if (zone === null) {
    return null
  }
  return `${CLOCK_LEAD} ${botTeamClockLine(now, zone)}. Read "today", "tomorrow", weekdays and times such as "at 9" on that clock, and give any date in that zone.`
}

/** The clock paragraph among a task's start notes, or null when it has none. */
export function botTeamClockNoteIn(notes: string | null | undefined): string | null {
  return notes?.split('\n\n').find((part) => part.startsWith(CLOCK_LEAD)) ?? null
}
