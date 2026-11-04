import { describe, expect, it, vi } from 'vitest'
import { hostWallTime } from '../../../../shared/bot-team-routine-schedule'
import { localTimeZone } from '../../../../shared/bot-team-routine-zone'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))

const { routineScheduleLine, routineWhenLabel, viewerWall } = await import('./BotTeamRoutineLabels')

const weekly = { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null } as const

describe('routine times for the viewer', () => {
  it("shows a run on the viewer's clock when the host sends its moment", () => {
    const at = Date.UTC(2026, 10, 2, 14, 0)
    expect(viewerWall({ date: '2026-11-02', time: '09:00' }, at)).toEqual(hostWallTime(at))
    // An older host sends only the routine's wall time.
    expect(viewerWall({ date: '2026-11-02', time: '09:00' })).toEqual({
      date: '2026-11-02',
      time: '09:00'
    })
    expect(routineWhenLabel({ date: '2026-11-02', time: '09:00' }, at)).toContain(
      hostWallTime(at).time
    )
  })

  it("names the routine's zone only when it is not the viewer's", () => {
    const elsewhere = localTimeZone() === 'Pacific/Kiritimati' ? 'Asia/Tokyo' : 'Pacific/Kiritimati'
    expect(routineScheduleLine({ ...weekly, timeZone: elsewhere })).toBe(
      `Every Monday at 09:00 (${elsewhere})`
    )
    expect(routineScheduleLine({ ...weekly, timeZone: localTimeZone() })).toBe(
      'Every Monday at 09:00'
    )
    expect(routineScheduleLine(weekly)).toBe('Every Monday at 09:00')
  })
})
