import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { BotTeamRoutine } from '../../../src/shared/rpc-contract/bot-team-routine-params'
import { MobileBotTeamScheduledRows, scheduledOnceRows } from './MobileBotTeamScheduledRows'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))

const routine = (overrides: Partial<BotTeamRoutine>): BotTeamRoutine => ({
  id: 'routine',
  teamId: 'team',
  botId: 'bot',
  name: 'Routine',
  prompt: 'Do the work.',
  schedule: { frequency: 'once', time: '10:00', weekday: null, monthDay: null, date: '2026-11-04' },
  paused: false,
  nextRun: { date: '2026-11-04', time: '10:00' },
  lastRun: null,
  ...overrides
})

const SOON = routine({ id: 'soon', name: 'Wednesday check-in' })
const LATER = routine({
  id: 'later',
  name: 'Friday check-in',
  schedule: { frequency: 'once', time: '09:00', weekday: null, monthDay: null, date: '2026-11-06' },
  nextRun: { date: '2026-11-06', time: '09:00' }
})
const WEEKLY = routine({
  id: 'weekly',
  name: 'Monday check-in',
  schedule: { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null },
  nextRun: { date: '2026-11-09', time: '09:00' }
})
const PAUSED = routine({ id: 'paused', name: 'Paused once', paused: true, nextRun: null })
const PASSED = routine({
  id: 'passed',
  name: 'Passed once',
  nextRun: null,
  lastRun: { scheduledFor: { date: '2026-11-04', time: '10:00' }, taskId: 't', error: null }
})

async function render(routines: BotTeamRoutine[]): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(createElement(MobileBotTeamScheduledRows, { routines }))
  })
  return renderer
}

const text = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON())

describe('scheduled one-time routines on a board', () => {
  it('picks the one-time routines still to run, soonest first', () => {
    expect(scheduledOnceRows([LATER, WEEKLY, PAUSED, PASSED, SOON]).map((row) => row.name)).toEqual(
      ['Wednesday check-in', 'Friday check-in']
    )
  })

  it('shows each one with its name and when it runs', async () => {
    const screen = text(await render([LATER, SOON, WEEKLY, PAUSED, PASSED]))
    expect(screen).toContain('Wednesday check-in')
    expect(screen).toContain('Scheduled · Wed 4 Nov, 10:00')
    expect(screen).toContain('Friday check-in')
    expect(screen).toContain('Scheduled · Fri 6 Nov, 09:00')
    expect(screen).not.toContain('Monday check-in')
    expect(screen).not.toContain('Paused once')
    expect(screen).not.toContain('Passed once')
  })

  it('draws nothing when no one-time routine is due', async () => {
    const renderer = await render([WEEKLY, PAUSED, PASSED])
    expect(renderer.toJSON()).toBeNull()
  })

  it('shows the next run on this device’s clock, when the host sent its moment', async () => {
    const shifted = routine({
      id: 'shifted',
      name: 'Shifted once',
      nextRun: { date: '2026-11-04', time: '10:00' },
      nextRunAt: new Date(2026, 10, 4, 13, 30).getTime()
    })
    const screen = text(await render([shifted]))
    expect(screen).toContain('Scheduled · Wed 4 Nov, 13:30')
    expect(screen).not.toContain('10:00')
  })

  it('sorts by the time the viewer sees, not the wall time the routine’s zone reads', () => {
    const later = routine({
      id: 'later-here',
      name: 'Later here',
      nextRun: { date: '2026-11-04', time: '10:00' },
      nextRunAt: new Date(2026, 10, 4, 13, 30).getTime()
    })
    const sooner = routine({
      id: 'sooner-here',
      name: 'Sooner here',
      nextRun: { date: '2026-11-04', time: '12:00' }
    })
    expect(scheduledOnceRows([later, sooner]).map((row) => row.name)).toEqual([
      'Sooner here',
      'Later here'
    ])
  })
})
