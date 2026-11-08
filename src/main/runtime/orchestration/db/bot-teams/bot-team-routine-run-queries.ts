import { z } from 'zod'
import type { OrchestrationDb } from '../orchestration-db'

/** The scheduled times of a routine's claimed runs in [from, to), earliest first. */
export function listBotTeamRoutineRunTimes(
  db: OrchestrationDb,
  routineId: string,
  from: number,
  to: number
): number[] {
  return z
    .array(z.object({ scheduled_for: z.number() }))
    .parse(
      db.db
        .prepare(
          'SELECT scheduled_for FROM bot_team_routine_runs WHERE routine_id = ? AND scheduled_for >= ? AND scheduled_for < ? ORDER BY scheduled_for'
        )
        .all(routineId, from, to)
    )
    .map((row) => row.scheduled_for)
}

/** A deleted team takes its routines and their runs with it. */
export function forgetOrphanedBotTeamRoutines(db: OrchestrationDb): void {
  const orphaned = 'team_id NOT IN (SELECT id FROM bot_teams)'
  db.db
    .prepare(
      `DELETE FROM bot_team_routine_runs WHERE routine_id IN (SELECT id FROM bot_team_routines WHERE ${orphaned})`
    )
    .run()
  db.db.prepare(`DELETE FROM bot_team_routines WHERE ${orphaned}`).run()
}
