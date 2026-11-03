import { describe, expect, it } from 'vitest'
import {
  formatCalendarTime,
  formatCalendarTitle,
  formatCalendarWeekday,
  formatUpcomingWhen
} from './calendar-format'

const local = (y: number, m: number, d: number, h = 0, min = 0): number =>
  new Date(y, m - 1, d, h, min).getTime()
// Intl separates times and ranges with narrow or thin spaces depending on the ICU version.
const plain = (text: string): string => text.replace(/\s/g, ' ')

const NOW = local(2026, 10, 31, 14, 24)
const labels = {
  today: (time: string) => `Today at ${time}`,
  tomorrow: (time: string) => `Tomorrow at ${time}`,
  other: (day: string, time: string) => `${day} at ${time}`
}

describe('calendar titles', () => {
  it('names the visible range as the boards do', () => {
    expect(plain(formatCalendarTitle('week', NOW, 'en-US'))).toBe('Oct 26 – Nov 1, 2026')
    expect(plain(formatCalendarTitle('day', NOW, 'en-US'))).toBe('Saturday, Oct 31, 2026')
    expect(plain(formatCalendarTitle('month', NOW, 'en-US'))).toBe('October 2026')
  })

  it('formats times and short weekdays in the given locale', () => {
    expect(plain(formatCalendarTime(NOW, 'en-US'))).toBe('2:24 PM')
    expect(formatCalendarWeekday(NOW, 'en-US')).toBe('Sat')
    expect(formatCalendarWeekday(NOW, 'es')).toMatch(/^sáb/)
  })
})

describe('upcoming run times', () => {
  it('says Today and Tomorrow, and names the day after that', () => {
    expect(plain(formatUpcomingWhen(local(2026, 10, 31, 15, 0), NOW, 'en-US', labels))).toBe(
      'Today at 3:00 PM'
    )
    expect(plain(formatUpcomingWhen(local(2026, 11, 1, 8, 30), NOW, 'en-US', labels))).toBe(
      'Tomorrow at 8:30 AM'
    )
    expect(plain(formatUpcomingWhen(local(2026, 11, 3, 9, 0), NOW, 'en-US', labels))).toBe(
      'Tue, Nov 3 at 9:00 AM'
    )
  })
})
