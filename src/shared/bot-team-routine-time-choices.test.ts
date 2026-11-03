import { describe, expect, it } from 'vitest'
import {
  ROUTINE_QUARTER_HOURS,
  isRoutineQuickTime,
  parseRoutineTypedTime,
  routineTimeOptions
} from './bot-team-routine-time-choices'

describe('routine time choices', () => {
  it('lists the day in 15-minute steps', () => {
    expect(ROUTINE_QUARTER_HOURS).toHaveLength(96)
    expect(ROUTINE_QUARTER_HOURS.slice(0, 2)).toEqual(['00:00', '00:15'])
    expect(ROUTINE_QUARTER_HOURS.at(-1)).toBe('23:45')
    expect(isRoutineQuickTime('15:00')).toBe(true)
    expect(isRoutineQuickTime('15:15')).toBe(false)
  })

  it('reads a typed time in the usual ways', () => {
    expect(parseRoutineTypedTime('9')).toBe('09:00')
    expect(parseRoutineTypedTime('930')).toBe('09:30')
    expect(parseRoutineTypedTime('21:05')).toBe('21:05')
    expect(parseRoutineTypedTime('9pm')).toBe('21:00')
    expect(parseRoutineTypedTime('12 am')).toBe('00:00')
    expect(parseRoutineTypedTime('25:00')).toBeNull()
    expect(parseRoutineTypedTime('13pm')).toBeNull()
    expect(parseRoutineTypedTime('soon')).toBeNull()
  })

  it('narrows the list to what is typed, offering an exact time first', () => {
    expect(routineTimeOptions('10:3')).toEqual(['10:30'])
    expect(routineTimeOptions('9')).toEqual(['09:00', '09:15', '09:30', '09:45'])
    expect(routineTimeOptions('10:05')).toEqual(['10:05'])
    expect(routineTimeOptions('')).toHaveLength(96)
  })
})
