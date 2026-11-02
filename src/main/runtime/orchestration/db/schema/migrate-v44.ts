import type { OrchestrationDb } from '../orchestration-db'

export function migrateV44(this: OrchestrationDb, current: number): void {
  if (current >= 44) {
    return
  }
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS bot_teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      purpose TEXT NOT NULL,
      character TEXT NOT NULL,
      workspaces_enabled INTEGER NOT NULL,
      access_mode TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bot_team_bots (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES bot_teams(id),
      name TEXT NOT NULL,
      job TEXT NOT NULL,
      agent TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bot_team_bots_team ON bot_team_bots(team_id);
  `)
}
