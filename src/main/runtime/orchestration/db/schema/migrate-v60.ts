import type { OrchestrationDb } from '../orchestration-db'

export function migrateV60(this: OrchestrationDb, current: number): void {
  if (current >= 60) {
    return
  }
  // Why: a skewed database restarts from an older schema, so these tables may already be there.
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS bot_team_task_origins (
      task_id TEXT PRIMARY KEY,
      origin_team_id TEXT NOT NULL,
      origin_message_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bot_team_task_origins_team ON bot_team_task_origins(origin_team_id);
    CREATE TABLE IF NOT EXISTS bot_team_returns (
      message_id TEXT PRIMARY KEY,
      from_team_id TEXT NOT NULL,
      from_task_id TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_team_returns_task ON bot_team_returns(from_task_id);
  `)
}
