import { nextRoutineRunAfter } from '../../../../../shared/bot-team-routine-schedule'
import type {
  BotTeamRoutine,
  BotTeamRoutineUpdateInput
} from '../../../../../shared/rpc-contract/bot-team-routine-params'
import type { OrchestrationDb } from '../orchestration-db'
import { keptSchedule, requireTeamBot } from './bot-team-routine-input'
import { getBotTeamRoutine } from './bot-team-routine-store'

/** Saves an edit; the next run is read again, so a finished Once routine with a new date runs again. */
export function updateBotTeamRoutine(
  db: OrchestrationDb,
  input: BotTeamRoutineUpdateInput,
  now: number
): BotTeamRoutine {
  const current = getBotTeamRoutine(db, input.routineId)
  requireTeamBot(db, current.teamId, input.botId)
  const schedule = keptSchedule(input.schedule)
  db.db
    .prepare(
      `UPDATE bot_team_routines
         SET bot_id = ?, name = ?, prompt = ?, frequency = ?, time_of_day = ?, weekday = ?, month_day = ?, run_date = ?, time_zone = ?, next_run_at = ?
       WHERE id = ?`
    )
    .run(
      input.botId,
      input.name,
      input.prompt,
      schedule.frequency,
      schedule.time,
      schedule.weekday,
      schedule.monthDay,
      schedule.date ?? null,
      schedule.timeZone ?? null,
      current.paused ? null : nextRoutineRunAfter(schedule, now),
      input.routineId
    )
  return getBotTeamRoutine(db, input.routineId)
}

/** Removes the routine and its run history; tasks it started stay on the board. */
export function deleteBotTeamRoutine(db: OrchestrationDb, routineId: string): void {
  getBotTeamRoutine(db, routineId)
  db.db.prepare('DELETE FROM bot_team_routine_runs WHERE routine_id = ?').run(routineId)
  db.db.prepare('DELETE FROM bot_team_routines WHERE id = ?').run(routineId)
}
