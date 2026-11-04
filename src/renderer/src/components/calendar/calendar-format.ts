import { addCalendarDays, startOfCalendarDay, startOfCalendarWeek } from './calendar-range'
import type { CalendarView } from './calendar-types'

export function formatCalendarTitle(view: CalendarView, anchor: number, locale: string): string {
  if (view === 'day') {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(anchor)
  }
  if (view === 'month') {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(anchor)
  }
  const monday = startOfCalendarWeek(anchor)
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).formatRange(monday, addCalendarDays(monday, 6))
}

export function formatCalendarTime(at: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(at)
}

export function formatCalendarWeekday(at: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(at)
}

export type UpcomingWhenLabels = {
  today: (time: string) => string
  tomorrow: (time: string) => string
  other: (day: string, time: string) => string
}

/** "Today at 2:24 PM", "Tomorrow at 8:30 AM", or the date for later days. */
export function formatUpcomingWhen(
  at: number,
  now: number,
  locale: string,
  labels: UpcomingWhenLabels
): string {
  const time = formatCalendarTime(at, locale)
  const today = startOfCalendarDay(now)
  const day = startOfCalendarDay(at)
  if (day === today) {
    return labels.today(time)
  }
  if (day === addCalendarDays(today, 1)) {
    return labels.tomorrow(time)
  }
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(at)
  return labels.other(date, time)
}
