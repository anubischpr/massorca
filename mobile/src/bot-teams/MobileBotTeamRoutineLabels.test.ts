import { describe, expect, it } from 'vitest'
import {
  mobileRoutineDateLabel,
  mobileRoutineRunsLine,
  mobileRoutineScheduleLine,
  mobileRoutineWhenLabel
} from './MobileBotTeamRoutineLabels'

const weekly = { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null } as const

describe('routine labels on the phone', () => {
  it('writes when a routine runs', () => {
    expect(mobileRoutineScheduleLine(weekly)).toBe('Every Monday at 09:00')
    expect(
      mobileRoutineScheduleLine({
        frequency: 'daily',
        time: '07:30',
        weekday: null,
        monthDay: null
      })
    ).toBe('Every day at 07:30')
    expect(
      mobileRoutineScheduleLine({
        frequency: 'monthly',
        time: '16:30',
        weekday: null,
        monthDay: 15
      })
    ).toBe('Every month on day 15 at 16:30')
    expect(mobileRoutineScheduleLine({ ...weekly, weekday: 0 })).toBe('Every Sunday at 09:00')
  })

  it('draws the host’s date as that same day, in the same words as the desktop', () => {
    expect(mobileRoutineDateLabel({ date: '2026-11-02', time: '09:00' })).toBe('Mon 2 Nov')
    expect(mobileRoutineWhenLabel({ date: '2026-11-09', time: '09:05' })).toBe('Mon 9 Nov, 09:05')
  })

  it('says what the last run and the next run are', () => {
    const routine = {
      paused: false,
      nextRun: { date: '2026-11-09', time: '09:00' },
      lastRun: {
        scheduledFor: { date: '2026-11-02', time: '09:00' },
        taskId: 't',
        error: null
      }
    }
    expect(mobileRoutineRunsLine(routine, 'Done')).toBe(
      'Last run Mon 2 Nov, done. Next run Mon 9 Nov, 09:00.'
    )
    expect(mobileRoutineRunsLine(routine, null)).toBe(
      'Last run Mon 2 Nov. Next run Mon 9 Nov, 09:00.'
    )
    expect(mobileRoutineRunsLine({ ...routine, lastRun: null }, null)).toBe(
      'Not run yet. Next run Mon 9 Nov, 09:00.'
    )
    expect(mobileRoutineRunsLine({ ...routine, paused: true, nextRun: null }, 'Stuck')).toBe(
      'Last run Mon 2 Nov, stuck. Paused.'
    )
  })
})
