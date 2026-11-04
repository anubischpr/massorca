import { describe, expect, it, vi } from 'vitest'
import type { Automation } from '../../../../shared/automations-types'
import {
  MAX_RUNS_PER_AUTOMATION,
  calendarAutomationTargets,
  expandAutomationRuns,
  listCalendarAutomations
} from './calendar-automation-runs'
import type { BotTeamScheduledRun } from '../../../../shared/rpc-contract/bot-team-scheduled-run-params'
import {
  BOT_RUNS_MAX_WINDOW_MS,
  botScheduledRunToCalendarRun,
  loadBotRuns
} from './calendar-bot-runs-source'
import { dropStartedBotRuns, loadCalendarRuns, nextRunStartAfter } from './calendar-runs-source'
import type { CalendarRun } from './calendar-types'

const mocks = vi.hoisted(() => ({ listScheduledRuns: vi.fn() }))
vi.mock('@/runtime/runtime-bot-team-client-routines', () => ({
  listBotTeamScheduledRuns: mocks.listScheduledRuns
}))

const local = (y: number, m: number, d: number, h = 0, min = 0): number =>
  new Date(y, m - 1, d, h, min).getTime()

const scheduledRun: BotTeamScheduledRun = {
  routineId: 'r2',
  routineName: 'Stock count',
  teamId: 't2',
  teamName: 'Warehouse',
  botId: 'b2',
  botName: 'Bea',
  botAgent: 'claude',
  projectId: null,
  projectName: null,
  frequency: 'daily',
  at: local(2026, 10, 2, 8),
  hostTime: { date: '2026-10-02', time: '08:00' }
}

const WEEK = { from: local(2026, 10, 26), to: local(2026, 11, 2) }

function automation(overrides: Partial<Automation> = {}): Automation {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the calendar reads only the fields set here.
  return {
    id: 'a1',
    name: 'Nightly triage',
    agentId: 'claude',
    rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
    dtstart: local(2026, 1, 1),
    enabled: true,
    timezone: 'UTC',
    nextRunAt: 0,
    ...overrides
  } as Automation
}

describe('automation runs on the calendar', () => {
  it('expands an enabled automation into its occurrences inside the window', () => {
    const runs = expandAutomationRuns([automation()], WEEK)
    expect(runs).toHaveLength(7)
    expect(runs[0]).toEqual({
      id: `automation:a1:${local(2026, 10, 26, 9)}`,
      name: 'Nightly triage',
      at: local(2026, 10, 26, 9),
      frequency: 'daily',
      source: 'automation',
      agentId: 'claude'
    })
    expect(runs.every((run) => run.at >= WEEK.from && run.at < WEEK.to)).toBe(true)
  })

  it('skips disabled automations and ones whose schedule cannot be read', () => {
    const runs = expandAutomationRuns(
      [automation({ enabled: false }), automation({ id: 'bad', rrule: 'FREQ=NOPE' })],
      WEEK
    )
    expect(runs).toEqual([])
  })

  it('names the cadence: weekdays, weekly, hourly, or custom for cron', () => {
    const frequencies = expandAutomationRuns(
      [
        automation({ id: 'w', rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=8;BYMINUTE=0' }),
        automation({ id: 'k', rrule: 'FREQ=WEEKLY;BYDAY=TU;BYHOUR=8;BYMINUTE=0' }),
        automation({ id: 'c', rrule: '30 7 * * 1' })
      ],
      WEEK
    ).map((run) => `${run.id.split(':')[1]}:${run.frequency}`)
    expect(new Set(frequencies)).toEqual(new Set(['w:weekdays', 'k:weekly', 'c:custom']))
    expect(frequencies.filter((entry) => entry.startsWith('w:'))).toHaveLength(5)
  })

  it('caps how many runs one automation adds', () => {
    const runs = expandAutomationRuns(
      [automation({ rrule: 'FREQ=HOURLY;BYMINUTE=0' })],
      { from: WEEK.from, to: WEEK.from + 31 * 24 * 60 * 60 * 1000 }
    )
    expect(runs[0].frequency).toBe('hourly')
    expect(runs).toHaveLength(MAX_RUNS_PER_AUTOMATION)
  })

  it('does not show runs before the automation starts', () => {
    const runs = expandAutomationRuns([automation({ dtstart: local(2026, 10, 30, 12) })], WEEK)
    expect(runs.map((run) => new Date(run.at).getDate())).toEqual([31, 1])
  })
})

describe('automation hosts', () => {
  it('asks this computer, and the active remote environment when one is set', () => {
    expect(calendarAutomationTargets(null)).toEqual([{ kind: 'local' }])
    expect(calendarAutomationTargets({ activeRuntimeEnvironmentId: 'env-1' })).toEqual([
      { kind: 'local' },
      { kind: 'environment', environmentId: 'env-1' }
    ])
  })

  it('keeps what answering hosts return when another host fails, once per automation', async () => {
    const list = vi.fn(async (target: { kind: string }) => {
      if (target.kind === 'environment') {
        throw new Error('unreachable')
      }
      return [automation(), automation()]
    })
    const listed = await listCalendarAutomations(
      [{ kind: 'local' }, { kind: 'environment', environmentId: 'env-1' }],
      list
    )
    expect(listed.map((entry) => entry.id)).toEqual(['a1'])
  })
})

describe('bot routine runs', () => {
  it('asks the host in windows of at most 62 days and maps every run', async () => {
    mocks.listScheduledRuns.mockResolvedValue({ runs: [scheduledRun], truncated: false })
    const from = local(2026, 10, 1)
    const to = from + 100 * 24 * 60 * 60 * 1000
    const runs = await loadBotRuns({ from, to })
    expect(mocks.listScheduledRuns.mock.calls.map(([query]) => query)).toEqual([
      { from, to: from + BOT_RUNS_MAX_WINDOW_MS },
      { from: from + BOT_RUNS_MAX_WINDOW_MS, to }
    ])
    expect(runs).toEqual([
      botScheduledRunToCalendarRun(scheduledRun),
      botScheduledRunToCalendarRun(scheduledRun)
    ])
  })

  it('reports unavailable for a host from before scheduled runs', async () => {
    mocks.listScheduledRuns.mockResolvedValue('unavailable')
    expect(await loadBotRuns(WEEK)).toBe('unavailable')
  })

  it('maps one scheduled routine run straight onto a calendar run', () => {
    expect(
      botScheduledRunToCalendarRun({
        routineId: 'r1',
        routineName: 'Launch brief',
        teamId: 't1',
        teamName: 'Marketing',
        botId: 'b1',
        botName: 'Nora',
        botAgent: 'claude',
        projectId: null,
        projectName: null,
        frequency: 'weekly',
        at: local(2026, 10, 31, 14, 24),
        hostTime: { date: '2026-10-31', time: '14:24' }
      })
    ).toEqual({
      id: `bot:r1:${local(2026, 10, 31, 14, 24)}`,
      name: 'Launch brief',
      at: local(2026, 10, 31, 14, 24),
      frequency: 'weekly',
      source: 'bot',
      botName: 'Nora',
      teamId: 't1',
      teamName: 'Marketing'
    })
  })
})

describe('merging both sources', () => {
  const botRun: CalendarRun = {
    id: 'bot:r1:x',
    name: 'Launch brief',
    at: local(2026, 10, 26, 8, 30),
    frequency: 'daily',
    source: 'bot',
    botName: 'Nora',
    teamId: 't1',
    teamName: 'Marketing'
  }

  it('lists bot runs and automation runs together in time order', async () => {
    const runs = await loadCalendarRuns(
      { from: WEEK.from, to: local(2026, 10, 27) },
      [automation()],
      async () => [botRun]
    )
    expect(runs.map((run) => run.name)).toEqual(['Launch brief', 'Nightly triage'])
  })

  it('still shows automations while bot runs are unavailable or fail', async () => {
    const day = { from: WEEK.from, to: local(2026, 10, 27) }
    expect(await loadCalendarRuns(day, [automation()], async () => 'unavailable')).toHaveLength(1)
    const failing = async (): Promise<CalendarRun[]> => {
      throw new Error('host down')
    }
    expect(await loadCalendarRuns(day, [automation()], failing)).toHaveLength(1)
  })
})

describe('runs that have started', () => {
  const now = local(2026, 10, 31, 14, 24)
  const botRun = (id: string, at: number): CalendarRun => ({
    id,
    name: 'Launch brief',
    at,
    frequency: 'daily',
    source: 'bot',
    botName: 'Nora',
    teamId: 't1',
    teamName: 'Marketing'
  })
  const triage: CalendarRun = {
    id: 'automation:a1:9',
    name: 'Nightly triage',
    at: local(2026, 10, 31, 9),
    frequency: 'daily',
    source: 'automation',
    agentId: 'claude'
  }

  it('drops a bot run once its time has passed, and keeps automation runs', () => {
    const started = botRun('bot:r1:14', local(2026, 10, 31, 14))
    const later = botRun('bot:r1:15', local(2026, 10, 31, 15))
    expect(dropStartedBotRuns([triage, started, later], now)).toEqual([triage, later])
  })

  it('names the next run to start across bot and automation runs, or null', () => {
    const later = botRun('bot:r1:15', local(2026, 10, 31, 15))
    const tomorrow: CalendarRun = {
      ...triage,
      id: 'automation:a1:tomorrow',
      at: local(2026, 11, 1, 9)
    }
    expect(nextRunStartAfter([triage, tomorrow, later], now)).toBe(later.at)
    expect(nextRunStartAfter([triage], now)).toBeNull()
  })
})
