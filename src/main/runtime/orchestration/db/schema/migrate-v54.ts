import type { OrchestrationDb } from '../orchestration-db'

export function migrateV54(this: OrchestrationDb, current: number): void {
  if (current >= 54) {
    return
  }
  // Why: no foreign keys, so deleting a team or removing a bot never fails on a routine; the scheduler forgets the orphans.
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS bot_team_routines (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      frequency TEXT NOT NULL,
      time_of_day TEXT NOT NULL,
      weekday INTEGER,
      month_day INTEGER,
      paused INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      next_run_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_bot_team_routines_team ON bot_team_routines(team_id);
    CREATE TABLE IF NOT EXISTS bot_team_routine_runs (
      id TEXT PRIMARY KEY,
      routine_id TEXT NOT NULL,
      scheduled_for INTEGER NOT NULL,
      task_id TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bot_team_routine_runs_routine ON bot_team_routine_runs(routine_id);
  `)
}
