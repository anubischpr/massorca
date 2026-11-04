/** The one-click times a routine offers before "Other time" (board 54). */
export const ROUTINE_QUICK_TIMES = [
  { key: 'morning', time: '09:00' },
  { key: 'noon', time: '12:00' },
  { key: 'afternoon', time: '15:00' },
  { key: 'evening', time: '19:00' }
] as const

export type RoutineQuickTimeKey = (typeof ROUTINE_QUICK_TIMES)[number]['key']

const two = (value: number): string => String(value).padStart(2, '0')

/** Every quarter hour of the day, as `HH:MM`. */
export const ROUTINE_QUARTER_HOURS: readonly string[] = Array.from(
  { length: 96 },
  (_, index) => `${two(Math.floor(index / 4))}:${two((index % 4) * 15)}`
)

export function isRoutineQuickTime(time: string): boolean {
  return ROUTINE_QUICK_TIMES.some((entry) => entry.time === time)
}

/** A typed time as `HH:MM`: "9", "930", "9:30", "21:05", "9pm" and "9:30 am" all read; null otherwise. */
export function parseRoutineTypedTime(typed: string): string | null {
  const match = /^\s*(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*$/i.exec(typed)
  if (!match) {
    return null
  }
  let hour = Number(match[1])
  const minute = match[2] === undefined ? 0 : Number(match[2])
  const half = match[3]?.toLowerCase().replace(/\./g, '')
  if (half !== undefined && (hour < 1 || hour > 12)) {
    return null
  }
  if (half === 'pm' && hour < 12) {
    hour += 12
  }
  if (half === 'am' && hour === 12) {
    hour = 0
  }
  return hour < 24 && minute < 60 ? `${two(hour)}:${two(minute)}` : null
}

/** The list for what is typed: the quarter hours it starts, and the exact time first when it reads as one. */
export function routineTimeOptions(typed: string): string[] {
  const query = typed.trim()
  if (query === '') {
    return [...ROUTINE_QUARTER_HOURS]
  }
  const exact = parseRoutineTypedTime(query)
  const digits = query.replace(/\D/g, '')
  const prefixed = ROUTINE_QUARTER_HOURS.filter(
    (time) =>
      time.startsWith(query) ||
      (digits !== '' &&
        time.replace(':', '').startsWith(digits.padStart(digits.length > 2 ? 4 : 2, '0')))
  )
  return exact === null || prefixed.includes(exact) ? prefixed : [exact, ...prefixed]
}
