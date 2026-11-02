import type { OrchestrationDb } from '../orchestration-db'

export function migrateV58(this: OrchestrationDb, current: number): void {
  if (current >= 58) {
    return
  }
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS bot_team_project_teams (
      project_id TEXT NOT NULL REFERENCES bot_team_projects(id),
      team_id TEXT NOT NULL REFERENCES bot_teams(id),
      PRIMARY KEY (project_id, team_id)
    );
    CREATE INDEX IF NOT EXISTS idx_bot_team_project_teams_team ON bot_team_project_teams(team_id);
  `)
  // Why: a skewed database restarts from v6, so the column may already be there.
  if (!this.hasColumn('bot_team_projects', 'archived_at')) {
    this.db.exec('ALTER TABLE bot_team_projects ADD COLUMN archived_at INTEGER')
  }
}
