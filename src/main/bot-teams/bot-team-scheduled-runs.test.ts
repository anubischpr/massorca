import { afterEach, describe, expect, it } from 'vitest'
import {
  BotTeamScheduledRunsQuery,
  BotTeamScheduledRunsResult
} from '../../shared/rpc-contract/bot-team-scheduled-run-params'
import {
  claimDueBotTeamRoutines,
  createBotTeamRoutine,
  setBotTeamRoutinePaused
} from '../runtime/orchestration/db/bot-teams/bot-team-routine-store'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { listBotTeamScheduledRuns } from './bot-team-scheduled-runs'

const DAY = 86_400_000

describe('listBotTeamScheduledRuns', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
  })

  function setup() {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    return { db, team, bot: team.bots[0] }
  }

  it('lists each unpaused routine run in the window, earliest first, with team and bot', () => {
    const { db, team, bot } = setup()
    const now = new Date(2026, 10, 3, 8, 0).getTime()
    createBotTeamRoutine(
      db,
      {
        teamId: team.id,
        botId: bot.id,
        name: 'Daily digest',
        prompt: 'Sum up the day',
        schedule: { frequency: 'daily', time: '09:00', weekday: null, monthDay: null }
      },
      now
    )
    const paused = createBotTeamRoutine(
      db,
      {
        teamId: team.id,
        botId: bot.id,
        name: 'Paused',
        prompt: 'x',
        schedule: { frequency: 'daily', time: '10:00', weekday: null, monthDay: null }
      },
      now
    )
    setBotTeamRoutinePaused(db, paused.id, true, now)

    const result = listBotTeamScheduledRuns(db, { from: now - DAY, to: now + 3 * DAY }, now)

    expect(result.truncated).toBe(false)
    expect(result.runs.map((run) => run.hostTime)).toEqual([
      { date: '2026-11-03', time: '09:00' },
      { date: '2026-11-04', time: '09:00' },
      { date: '2026-11-05', time: '09:00' }
    ])
    expect(result.runs[0]).toMatchObject({
      routineName: 'Daily digest',
      teamId: team.id,
      teamName: 'Marketing',
      botName: 'Iris',
      botAgent: 'claude',
      projectId: null,
      frequency: 'daily'
    })
  })

  it('lists a one-time routine once, in the Calendar shape, and not after it ran', () => {
    const { db, team, bot } = setup()
    const now = new Date(2026, 10, 3, 8, 0).getTime()
    createBotTeamRoutine(
      db,
      {
        teamId: team.id,
        botId: bot.id,
        name: 'Front review',
        prompt: 'Review the front end',
        schedule: {
          frequency: 'once',
          time: '10:00',
          weekday: null,
          monthDay: null,
          date: '2026-11-04'
        }
      },
      now
    )

    const result = listBotTeamScheduledRuns(db, { from: now, to: now + 10 * DAY }, now)

    expect(result.runs).toHaveLength(1)
    expect(result.runs[0]).toMatchObject({
      routineName: 'Front review',
      frequency: 'once',
      hostTime: { date: '2026-11-04', time: '10:00' }
    })
    expect(BotTeamScheduledRunsResult.parse(result)).toEqual(result)
    const later = new Date(2026, 10, 5, 8, 0).getTime()
    expect(listBotTeamScheduledRuns(db, { from: later, to: later + DAY }, later).runs).toEqual([])
  })

  it('filters by team and lists nothing for a team with no routines', () => {
    const { db } = setup()
    const now = Date.now()
    expect(listBotTeamScheduledRuns(db, { from: now, to: now + DAY, teamId: 'none' }, now)).toEqual(
      { runs: [], truncated: false }
    )
  })

  it('refuses a window that ends before it starts or is over 62 days', () => {
    expect(BotTeamScheduledRunsQuery.safeParse({ from: 10, to: 5 }).success).toBe(false)
    expect(BotTeamScheduledRunsQuery.safeParse({ from: 0, to: 63 * DAY }).success).toBe(false)
    expect(BotTeamScheduledRunsQuery.safeParse({ from: 0, to: 62 * DAY }).success).toBe(true)
  })

  it('lists runs that already started only when asked, paused routines included', () => {
    const { db, team, bot } = setup()
    const daily = (time: string) =>
      ({ frequency: 'daily', time, weekday: null, monthDay: null }) as const
    const created = new Date(2026, 10, 1, 12, 0).getTime()
    createBotTeamRoutine(
      db,
      {
        teamId: team.id,
        botId: bot.id,
        name: 'Daily digest',
        prompt: 'x',
        schedule: daily('09:00')
      },
      created
    )
    const paused = createBotTeamRoutine(
      db,
      { teamId: team.id, botId: bot.id, name: 'Paused', prompt: 'x', schedule: daily('10:00') },
      created
    )
    // Both ran on 2 Nov; pausing the second routine afterwards must not hide the run that happened.
    claimDueBotTeamRoutines(db, new Date(2026, 10, 2, 10, 30).getTime())
    setBotTeamRoutinePaused(db, paused.id, true, new Date(2026, 10, 2, 10, 31).getTime())
    const now = new Date(2026, 10, 2, 11, 0).getTime()
    const day = { from: new Date(2026, 10, 2).getTime(), to: new Date(2026, 10, 3).getTime() }

    expect(listBotTeamScheduledRuns(db, day, now).runs).toEqual([])
    const asked = listBotTeamScheduledRuns(db, { ...day, includePast: true }, now)
    expect(asked.runs.map((run) => [run.routineName, run.hostTime.time])).toEqual([
      ['Daily digest', '09:00'],
      ['Paused', '10:00']
    ])
    expect(asked.truncated).toBe(false)
  })

  it('forgets a deleted team, its past runs included', () => {
    const { db, team, bot } = setup()
    createBotTeamRoutine(
      db,
      {
        teamId: team.id,
        botId: bot.id,
        name: 'Daily digest',
        prompt: 'x',
        schedule: { frequency: 'daily', time: '09:00', weekday: null, monthDay: null }
      },
      new Date(2026, 10, 1, 12, 0).getTime()
    )
    claimDueBotTeamRoutines(db, new Date(2026, 10, 2, 9, 30).getTime())
    db.deleteBotTeam(team.id)
    const day = {
      from: new Date(2026, 10, 2).getTime(),
      to: new Date(2026, 10, 3).getTime(),
      includePast: true
    }
    expect(listBotTeamScheduledRuns(db, day, new Date(2026, 10, 2, 11, 0).getTime()).runs).toEqual(
      []
    )
  })

  it('takes includePast as an optional flag, so a host that predates it simply ignores it', () => {
    expect(BotTeamScheduledRunsQuery.parse({ from: 0, to: DAY }).includePast).toBeUndefined()
    expect(
      BotTeamScheduledRunsQuery.parse({ from: 0, to: DAY, includePast: true }).includePast
    ).toBe(true)
  })
})
