import { describe, expect, it } from 'vitest'
import {
  hostWallTime,
  latestRoutineRunAtOrBefore,
  nextRoutineRunAfter,
  onceRoutineRunAt,
  routineCron
} from './bot-team-routine-schedule'

// Local time on purpose: a routine runs on the host's clock, whatever zone that is.
const at = (month: number, day: number, hour = 0, minute = 0): number =>
  new Date(2026, month - 1, day, hour, minute).getTime()

const daily = { frequency: 'daily', time: '09:00', weekday: null, monthDay: null } as const
const mondays = { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null } as const
const fifteenth = { frequency: 'monthly', time: '16:30', weekday: null, monthDay: 15 } as const

describe('bot team routine schedule', () => {
  it('writes each frequency as one cron line', () => {
    expect(routineCron(daily)).toBe('0 9 * * *')
    expect(routineCron(mondays)).toBe('0 9 * * 1')
    expect(routineCron(fifteenth)).toBe('30 16 15 * *')
  })

  it('finds the next run strictly after a moment', () => {
    expect(nextRoutineRunAfter(daily, at(11, 2, 8, 0))).toBe(at(11, 2, 9, 0))
    expect(nextRoutineRunAfter(daily, at(11, 2, 9, 0))).toBe(at(11, 3, 9, 0))
    // 2 Nov 2026 is a Monday.
    expect(nextRoutineRunAfter(mondays, at(11, 2, 9, 0))).toBe(at(11, 9, 9, 0))
    expect(nextRoutineRunAfter(fifteenth, at(11, 15, 16, 30))).toBe(at(12, 15, 16, 30))
  })

  it('collapses every run missed since the last one into the latest', () => {
    // Asleep from Monday 9:00 to Thursday 10:00: one run for Thursday 9:00, not four.
    expect(latestRoutineRunAtOrBefore(daily, at(11, 2, 9, 0), at(11, 5, 10, 0))).toBe(
      at(11, 5, 9, 0)
    )
    expect(latestRoutineRunAtOrBefore(mondays, at(11, 2, 9, 0), at(11, 5, 10, 0))).toBeNull()
    expect(latestRoutineRunAtOrBefore(daily, at(11, 5, 9, 0), at(11, 5, 10, 0))).toBeNull()
  })

  it('runs a one-time routine at its date and never again', () => {
    const once = { ...daily, frequency: 'once', date: '2026-11-04' } as const
    expect(onceRoutineRunAt(once)).toBe(at(11, 4, 9, 0))
    expect(nextRoutineRunAfter(once, at(11, 3, 12, 0))).toBe(at(11, 4, 9, 0))
    expect(nextRoutineRunAfter(once, at(11, 4, 9, 0))).toBeNull()
    // Asleep through it: it still runs late, once.
    expect(latestRoutineRunAtOrBefore(once, at(11, 4, 8, 59), at(11, 5, 10, 0))).toBe(
      at(11, 4, 9, 0)
    )
    expect(latestRoutineRunAtOrBefore(once, at(11, 4, 9, 0), at(11, 5, 10, 0))).toBeNull()
  })

  it('refuses a one-time date that is missing or not on the calendar', () => {
    expect(onceRoutineRunAt({ ...daily, frequency: 'once', date: null })).toBeNull()
    expect(onceRoutineRunAt({ ...daily, frequency: 'once', date: '2026-02-30' })).toBeNull()
  })

  it("runs on the clock of the routine's zone, across a DST change", () => {
    const madrid = { ...daily, timeZone: 'Europe/Madrid' } as const
    // Madrid is UTC+2 until 25 Oct 2026 and UTC+1 after.
    expect(nextRoutineRunAfter(madrid, Date.UTC(2026, 9, 24, 12, 0))).toBe(
      Date.UTC(2026, 9, 25, 8, 0)
    )
    expect(nextRoutineRunAfter(madrid, Date.UTC(2026, 9, 23, 12, 0))).toBe(
      Date.UTC(2026, 9, 24, 7, 0)
    )
    const mondays = { frequency: 'weekly', time: '18:30', weekday: 1, monthDay: null } as const
    expect(
      nextRoutineRunAfter({ ...mondays, timeZone: 'America/Bogota' }, Date.UTC(2026, 10, 2, 23, 0))
    ).toBe(Date.UTC(2026, 10, 2, 23, 30))
    const once = {
      ...daily,
      frequency: 'once',
      date: '2026-11-04',
      timeZone: 'Asia/Tokyo'
    } as const
    expect(onceRoutineRunAt(once)).toBe(Date.UTC(2026, 10, 4, 0, 0))
    // Asleep through two runs: only the latest, in the zone.
    expect(
      latestRoutineRunAtOrBefore(madrid, Date.UTC(2026, 10, 2, 8, 0), Date.UTC(2026, 10, 4, 9, 0))
    ).toBe(Date.UTC(2026, 10, 4, 8, 0))
  })

  it('keeps a routine with no zone, or one this host does not know, on the host clock', () => {
    expect(nextRoutineRunAfter({ ...daily, timeZone: null }, at(11, 2, 8, 0))).toBe(at(11, 2, 9, 0))
    expect(nextRoutineRunAfter({ ...daily, timeZone: 'Mars/Olympus' }, at(11, 2, 8, 0))).toBe(
      at(11, 2, 9, 0)
    )
  })

  it('reads a moment on a zone clock', () => {
    expect(hostWallTime(Date.UTC(2026, 10, 4, 0, 0), 'Asia/Tokyo')).toEqual({
      date: '2026-11-04',
      time: '09:00'
    })
  })

  it('reads a moment as the host sees it', () => {
    expect(hostWallTime(at(11, 9, 9, 5))).toEqual({ date: '2026-11-09', time: '09:05' })
  })
})
