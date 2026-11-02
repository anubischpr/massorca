import type { OrchestrationDb } from '../orchestration-db'

export function migrateV50(this: OrchestrationDb, current: number): void {
  if (current >= 50) {
    return
  }
  // Why: a skewed database restarts from v6, so these columns may already be there.
  if (!this.hasColumn('bot_team_projects', 'brief_json')) {
    this.db.exec('ALTER TABLE bot_team_projects ADD COLUMN brief_json TEXT')
  }
  if (!this.hasColumn('bot_team_projects', 'brief_updated_at')) {
    this.db.exec('ALTER TABLE bot_team_projects ADD COLUMN brief_updated_at INTEGER')
  }
}
