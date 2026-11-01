import type { OrchestrationDb } from '../orchestration-db'

export function migrateV48(this: OrchestrationDb, current: number): void {
  if (current >= 48) {
    return
  }
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS bot_team_projects (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES bot_teams(id),
      name TEXT NOT NULL,
      goal TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_bot_team_projects_team ON bot_team_projects(team_id);
    ALTER TABLE bot_team_tasks ADD COLUMN project_id TEXT REFERENCES bot_team_projects(id);
  `)
}
