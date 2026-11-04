import type { CalendarRange, CalendarRun, CalendarView } from './calendar-types'

/** Local-calendar day arithmetic; Date handles daylight-saving shifts. */
export function addCalendarDays(at: number, days: number): number {
  const date = new Date(at)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function startOfCalendarDay(at: number): number {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Weeks start on Monday, as the boards draw them. */
export function startOfCalendarWeek(at: number): number {
  const day = startOfCalendarDay(at)
  const mondayOffset = (new Date(day).getDay() + 6) % 7
  return addCalendarDays(day, -mondayOffset)
}

function startOfCalendarMonth(at: number): number {
  const date = new Date(at)
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

export function calendarWeekDays(anchor: number): number[] {
  const monday = startOfCalendarWeek(anchor)
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(monday, index))
}

export type CalendarMonthDay = { day: number; inMonth: boolean }

/** Whole Monday-first weeks from the week holding the 1st to the week holding the last day. */
export function monthGridDays(anchor: number): CalendarMonthDay[] {
  const first = startOfCalendarMonth(anchor)
  const month = new Date(first).getMonth()
  const days: CalendarMonthDay[] = []
  let day = startOfCalendarWeek(first)
  do {
    for (let index = 0; index < 7; index += 1) {
      days.push({ day, inMonth: new Date(day).getMonth() === month })
      day = addCalendarDays(day, 1)
    }
  } while (new Date(day).getMonth() === month)
  return days
}

export function calendarRange(view: CalendarView, anchor: number): CalendarRange {
  if (view === 'day') {
    const from = startOfCalendarDay(anchor)
    return { from, to: addCalendarDays(from, 1) }
  }
  if (view === 'week') {
    const from = startOfCalendarWeek(anchor)
    return { from, to: addCalendarDays(from, 7) }
  }
  const days = monthGridDays(anchor)
  return { from: days[0].day, to: addCalendarDays(days[0].day, days.length) }
}

/** Previous and Next: one day, one week, or the 1st of the neighbouring month. */
export function shiftCalendarAnchor(view: CalendarView, anchor: number, step: 1 | -1): number {
  if (view === 'day') {
    return addCalendarDays(startOfCalendarDay(anchor), step)
  }
  if (view === 'week') {
    return addCalendarDays(startOfCalendarDay(anchor), step * 7)
  }
  const date = new Date(startOfCalendarMonth(anchor))
  return new Date(date.getFullYear(), date.getMonth() + step, 1).getTime()
}

export function runsInRange(runs: readonly CalendarRun[], range: CalendarRange): CalendarRun[] {
  return runs.filter((run) => run.at >= range.from && run.at < range.to).sort((a, b) => a.at - b.at)
}

export function runsOnDay(runs: readonly CalendarRun[], day: number): CalendarRun[] {
  const from = startOfCalendarDay(day)
  return runsInRange(runs, { from, to: addCalendarDays(from, 1) })
}

export type CalendarHourRow = { at: number; runs: CalendarRun[] }

const FIRST_ROW_HOUR = 8
const LAST_ROW_HOUR = 18
const ROW_HOURS = 2

/** Day view rows: two-hour slots from 8 AM to 6 PM, widened to reach every run of the day. */
export function dayHourRows(runs: readonly CalendarRun[], day: number): CalendarHourRow[] {
  const dayRuns = runsOnDay(runs, day)
  const slotOf = (run: CalendarRun): number =>
    Math.floor(new Date(run.at).getHours() / ROW_HOURS) * ROW_HOURS
  const hours = dayRuns.map(slotOf)
  const first = Math.min(FIRST_ROW_HOUR, ...hours)
  const last = Math.max(LAST_ROW_HOUR, ...hours)
  const rows: CalendarHourRow[] = []
  for (let hour = first; hour <= last; hour += ROW_HOURS) {
    const at = new Date(day)
    at.setHours(hour, 0, 0, 0)
    rows.push({ at: at.getTime(), runs: dayRuns.filter((run) => slotOf(run) === hour) })
  }
  return rows
}
