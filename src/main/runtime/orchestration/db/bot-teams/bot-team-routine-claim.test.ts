import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationDb } from '../orchestration-db'
import { claimDueBotTeamRoutines, createBotTeamRoutine } from './bot-team-routine-store'

const at = (month: number, day: number, hour = 0, minute = 0): number =>
  new Date(2026, month - 1, day, hour, minute).getTime()

describe('claiming due bot team routines', () => {
  let db: OrchestrationDb | undefined
  afterEach(() => {
    db?.close()
    db = undefined
    vi.restoreAllMocks()
  })

  function setup(routines: number) {
    db = new OrchestrationDb(':memory:')
    const team = db.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled: false,
      bots: [{ name: 'Nora', job: 'Writes', agent: 'claude' }]
    })
    const made = Array.from({ length: routines }, (_, index) =>
      createBotTeamRoutine(
        db as OrchestrationDb,
        {
          teamId: team.id,
          botId: team.bots[0].id,
          name: `Routine ${index + 1}`,
          prompt: 'List what is still open.',
          schedule: { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null }
        },
        at(11, 1, 12, 0)
      )
    )
    return { db, made }
  }

  const runs = (database: OrchestrationDb) =>
    database.db
      .prepare('SELECT routine_id, task_id, error FROM bot_team_routine_runs ORDER BY rowid')
      .all()

  it('keeps the claims it already made when a later routine cannot be read back', () => {
    const { db, made } = setup(2)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // Past the schema's limit, so building this routine for its run fails after it was claimed.
    db.db
      .prepare('UPDATE bot_team_routines SET time_zone = ? WHERE id = ?')
      .run('x'.repeat(70), made[1].id)

    const claimed = claimDueBotTeamRoutines(db, at(11, 2, 9, 0))

    expect(claimed.map((claim) => claim.routine.id)).toEqual([made[0].id])
    expect(runs(db)).toEqual([
      { routine_id: made[0].id, task_id: null, error: null },
      {
        routine_id: made[1].id,
        task_id: null,
        error: expect.stringContaining('could not be started')
      }
    ])
  })

  it('records a skipped run, with its reason, when no run time matches what was due', () => {
    const { db, made } = setup(1)
    // Due on a Tuesday, though the routine runs on Mondays: nothing in the window matches.
    db.db
      .prepare('UPDATE bot_team_routines SET next_run_at = ? WHERE id = ?')
      .run(at(11, 3, 10, 0), made[0].id)

    expect(claimDueBotTeamRoutines(db, at(11, 3, 10, 0))).toEqual([])

    expect(runs(db)).toEqual([
      {
        routine_id: made[0].id,
        task_id: null,
        error: expect.stringContaining('skipped')
      }
    ])
  })
})
