import { describe, expect, it } from 'vitest'
import {
  calendarRange,
  calendarWeekDays,
  dayHourRows,
  monthGridDays,
  runsOnDay,
  shiftCalendarAnchor,
  startOfCalendarWeek
} from './calendar-range'
import type { CalendarRun } from './calendar-types'

const local = (y: number, m: number, d: number, h = 0, min = 0): number =>
  new Date(y, m - 1, d, h, min).getTime()

// Saturday, Oct 31 2026, as on the canvas boards.
const NOW = local(2026, 10, 31, 14, 24)

function run(name: string, at: number): CalendarRun {
  return { id: `${name}-${at}`, name, at, frequency: 'daily', source: 'bot' }
}

describe('calendar ranges', () => {
  it('starts the week on Monday, so Oct 31 sits in Oct 26 - Nov 1', () => {
    expect(startOfCalendarWeek(NOW)).toBe(local(2026, 10, 26))
    expect(calendarRange('week', NOW)).toEqual({ from: local(2026, 10, 26), to: local(2026, 11, 2) })
    expect(calendarWeekDays(NOW)).toEqual([26, 27, 28, 29, 30, 31, 1].map((day, index) =>
      local(2026, index < 6 ? 10 : 11, day)
    ))
  })

  it('treats Sunday as the last day of its week', () => {
    expect(startOfCalendarWeek(local(2026, 11, 1, 9))).toBe(local(2026, 10, 26))
  })

  it('covers one local day in Day view', () => {
    expect(calendarRange('day', NOW)).toEqual({ from: local(2026, 10, 31), to: local(2026, 11, 1) })
  })

  it('covers whole Monday-first weeks around the month in Month view', () => {
    const days = monthGridDays(NOW)
    expect(days).toHaveLength(35)
    expect(days[0]).toEqual({ day: local(2026, 9, 28), inMonth: false })
    expect(days[3]).toEqual({ day: local(2026, 10, 1), inMonth: true })
    expect(days[34]).toEqual({ day: local(2026, 11, 1), inMonth: false })
    expect(calendarRange('month', NOW)).toEqual({ from: local(2026, 9, 28), to: local(2026, 11, 2) })
  })

  it('adds a sixth week when the month needs it', () => {
    // March 2026 starts on a Sunday.
    expect(monthGridDays(local(2026, 3, 15))).toHaveLength(42)
  })

  it('moves by one day, week or month for Previous and Next', () => {
    expect(shiftCalendarAnchor('day', NOW, 1)).toBe(local(2026, 11, 1))
    expect(shiftCalendarAnchor('week', NOW, -1)).toBe(local(2026, 10, 24))
    expect(shiftCalendarAnchor('month', NOW, 1)).toBe(local(2026, 11, 1))
    expect(shiftCalendarAnchor('month', local(2026, 1, 31), 1)).toBe(local(2026, 2, 1))
  })
})

describe('grouping runs', () => {
  const runs = [
    run('Signals digest', local(2026, 11, 1, 15, 30)),
    run('Competitor scan', local(2026, 11, 1, 8, 30)),
    run('Launch brief', local(2026, 10, 31, 14, 24))
  ]

  it('lists the runs of one day in time order', () => {
    expect(runsOnDay(runs, local(2026, 11, 1)).map((r) => r.name)).toEqual([
      'Competitor scan',
      'Signals digest'
    ])
  })

  it('puts Day view runs in two-hour rows from 8 AM to 6 PM', () => {
    const rows = dayHourRows(runs, local(2026, 10, 31))
    expect(rows.map((row) => new Date(row.at).getHours())).toEqual([8, 10, 12, 14, 16, 18])
    expect(rows[3].runs.map((r) => r.name)).toEqual(['Launch brief'])
    expect(rows.filter((row) => row.runs.length > 0)).toHaveLength(1)
  })

  it('extends the rows to runs outside 8 AM - 6 PM', () => {
    const early = run('Night sync', local(2026, 10, 31, 5, 15))
    const late = run('Late report', local(2026, 10, 31, 21, 0))
    const rows = dayHourRows([early, late], local(2026, 10, 31))
    expect(rows.map((row) => new Date(row.at).getHours())).toEqual([
      4, 6, 8, 10, 12, 14, 16, 18, 20
    ])
    expect(rows[0].runs).toEqual([early])
    expect(rows[8].runs).toEqual([late])
  })
})
