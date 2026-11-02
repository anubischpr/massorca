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
  `)
  // Why: a skewed database restarts from v6, so this column may already be there.
  if (!this.hasColumn('bot_team_tasks', 'project_id')) {
    this.db.exec(
      'ALTER TABLE bot_team_tasks ADD COLUMN project_id TEXT REFERENCES bot_team_projects(id)'
    )
  }
}
