import { describe, expect, it, vi } from 'vitest'
import {
  mobileRoutineDateLabel,
  mobileRoutineNextRunDetail,
  mobileRoutineRunsLine,
  mobileRoutineScheduleLine,
  mobileRoutineWhenLabel,
  mobileViewerWall
} from './MobileBotTeamRoutineLabels'

const zone = vi.hoisted((): { current: string | null } => ({ current: 'America/Bogota' }))
vi.mock('../../../src/shared/bot-team-routine-zone', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/shared/bot-team-routine-zone')>()),
  localTimeZone: () => zone.current
}))

const weekly = { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null } as const
const once = {
  frequency: 'once',
  time: '10:00',
  weekday: null,
  monthDay: null,
  date: '2026-11-04'
} as const

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
      schedule: weekly,
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

  it('writes when a one-time routine runs, in the same words as the desktop', () => {
    expect(mobileRoutineScheduleLine(once)).toBe('Once on Wed 4 Nov at 10:00')
  })

  it('says what became of a one-time routine, and that a passed one did not run', () => {
    const passed = {
      paused: false,
      schedule: once,
      nextRun: null,
      lastRun: { scheduledFor: { date: '2026-11-04', time: '10:00' }, taskId: 't', error: null }
    }
    expect(mobileRoutineRunsLine(passed, 'Done')).toBe('Done. Ran Wed 4 Nov, done.')
    expect(mobileRoutineRunsLine(passed, null)).toBe('Done. Ran Wed 4 Nov.')
    expect(mobileRoutineRunsLine({ ...passed, lastRun: null }, null)).toBe('Past. It did not run.')
  })

  it('keeps a one-time routine still to run, or paused, out of the past', () => {
    const upcoming = {
      paused: false,
      schedule: once,
      nextRun: { date: '2026-11-04', time: '10:00' },
      lastRun: null
    }
    expect(mobileRoutineRunsLine(upcoming, null)).toBe('Not run yet. Next run Wed 4 Nov, 10:00.')
    expect(mobileRoutineRunsLine({ ...upcoming, paused: true, nextRun: null }, null)).toBe(
      'Not run yet. Paused.'
    )
  })

  it('names the zone a routine runs in, when that is not this device’s', () => {
    expect(mobileRoutineScheduleLine({ ...weekly, timeZone: 'Europe/Madrid' })).toBe(
      'Every Monday at 09:00 (Europe/Madrid)'
    )
    expect(mobileRoutineScheduleLine({ ...once, timeZone: 'Europe/Madrid' })).toBe(
      'Once on Wed 4 Nov at 10:00 (Europe/Madrid)'
    )
    expect(mobileRoutineScheduleLine({ ...weekly, timeZone: 'America/Bogota' })).toBe(
      'Every Monday at 09:00'
    )
    expect(mobileRoutineScheduleLine({ ...weekly, timeZone: null })).toBe('Every Monday at 09:00')
  })

  it('draws a moment on this device’s clock when the host sent it, else the wall time', () => {
    const at = new Date(2026, 10, 9, 13, 30).getTime()
    expect(mobileViewerWall({ date: '2026-11-09', time: '09:00' }, at)).toEqual({
      date: '2026-11-09',
      time: '13:30'
    })
    expect(mobileViewerWall({ date: '2026-11-09', time: '09:00' }, null)).toEqual({
      date: '2026-11-09',
      time: '09:00'
    })
  })

  it('says the next and the last run on this device’s clock', () => {
    const routine = {
      paused: false,
      schedule: weekly,
      nextRun: { date: '2026-11-09', time: '09:00' },
      nextRunAt: new Date(2026, 10, 9, 13, 30).getTime(),
      lastRun: {
        scheduledFor: { date: '2026-11-02', time: '09:00' },
        scheduledAt: new Date(2026, 10, 3, 1, 15).getTime(),
        taskId: 't',
        error: null
      }
    }
    expect(mobileRoutineRunsLine(routine, 'Done')).toBe(
      'Last run Tue 3 Nov, done. Next run Mon 9 Nov, 13:30.'
    )
  })

  it('shows the next run, None once a one-time routine has run, or Paused', () => {
    expect(
      mobileRoutineNextRunDetail({
        paused: false,
        schedule: weekly,
        nextRun: { date: '2026-11-09', time: '09:00' },
        nextRunAt: new Date(2026, 10, 9, 13, 30).getTime()
      })
    ).toBe('Next run Mon 9 Nov, 13:30')
    expect(mobileRoutineNextRunDetail({ paused: false, schedule: once, nextRun: null })).toBe(
      'None. It ran once.'
    )
    expect(mobileRoutineNextRunDetail({ paused: true, schedule: once, nextRun: null })).toBe(
      'Paused.'
    )
  })
})
