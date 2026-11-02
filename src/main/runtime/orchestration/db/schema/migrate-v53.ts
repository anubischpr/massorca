import type { OrchestrationDb } from '../orchestration-db'

export function migrateV53(this: OrchestrationDb, current: number): void {
  if (current >= 53) {
    return
  }
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS bot_team_memory (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES bot_teams(id),
      bot_id TEXT REFERENCES bot_team_bots(id),
      text TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      source_title TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bot_team_memory_team ON bot_team_memory(team_id);
  `)
}
