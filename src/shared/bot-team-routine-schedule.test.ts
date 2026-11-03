import { describe, expect, it } from 'vitest'
import {
  hostWallTime,
  latestRoutineRunAtOrBefore,
  nextRoutineRunAfter,
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

  it('reads a moment as the host sees it', () => {
    expect(hostWallTime(at(11, 9, 9, 5))).toEqual({ date: '2026-11-09', time: '09:05' })
  })
})
