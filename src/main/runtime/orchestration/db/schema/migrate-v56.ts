import type { OrchestrationDb } from '../orchestration-db'

export function migrateV56(this: OrchestrationDb, current: number): void {
  if (current >= 56) {
    return
  }
  // Why: a skewed database restarts from v6, so either column may already be there.
  if (!this.hasColumn('bot_team_projects', 'workspace_key')) {
    this.db.exec('ALTER TABLE bot_team_projects ADD COLUMN workspace_key TEXT')
  }
  if (!this.hasColumn('bot_team_projects', 'workspace_name')) {
    this.db.exec('ALTER TABLE bot_team_projects ADD COLUMN workspace_name TEXT')
  }
}
