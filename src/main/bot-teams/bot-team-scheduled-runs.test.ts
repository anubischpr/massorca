import { afterEach, describe, expect, it } from 'vitest'
import { BotTeamScheduledRunsQuery } from '../../shared/rpc-contract/bot-team-scheduled-run-params'
import {
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
})
