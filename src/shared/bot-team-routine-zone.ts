/** A date and a time as a clock in some zone reads them. */
export type ZonedWall = { year: number; month: number; day: number; hour: number; minute: number }

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/** True for a zone this runtime knows, such as "America/Bogota". */
export function isKnownTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone)
    return true
  } catch {
    return false
  }
}

export function zonedWall(timestamp: number, timeZone: string): ZonedWall {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(timestamp)
      .map((part) => [part.type, Number(part.value)])
  )
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute
  }
}

const asUtc = (wall: ZonedWall): number =>
  Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)

/**
 * The moment a zone's clock reads `wall`. A time a DST change skips moves later by the jump; a time
 * the clock reads twice is its first reading.
 */
export function zonedInstant(wall: ZonedWall, timeZone: string): number {
  const target = asUtc(wall)
  const offsetAt = (at: number): number => asUtc(zonedWall(at, timeZone)) - at
  const before = target - offsetAt(target - 86_400_000)
  if (asUtc(zonedWall(before, timeZone)) === target) {
    return before
  }
  const after = target - offsetAt(target + 86_400_000)
  if (asUtc(zonedWall(after, timeZone)) === target) {
    return after
  }
  // In the gap: the clock jumps past `wall`, so take the moment the jump lands on.
  return Math.max(before, after)
}

/** The calendar day `days` after a wall date, at that wall time. */
export function shiftWallDays(wall: ZonedWall, days: number): ZonedWall {
  const moved = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days))
  return {
    ...wall,
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate()
  }
}

/** Cron's weekday of a wall date: 0 is Sunday. */
export function wallWeekday(wall: ZonedWall): number {
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay()
}

/** The sender's zone as an optional field, left out when this runtime cannot say. */
export function withSenderTimeZone<T extends object>(input: T): T & { timeZone?: string } {
  const timeZone = localTimeZone()
  return timeZone === null ? input : { ...input, timeZone }
}

/** The zone this runtime runs in, or null when it cannot say. */
export function localTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return zone && isKnownTimeZone(zone) ? zone : null
  } catch {
    return null
  }
}
