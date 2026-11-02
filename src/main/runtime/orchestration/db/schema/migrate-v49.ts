import type { OrchestrationDb } from '../orchestration-db'

export function migrateV49(this: OrchestrationDb, current: number): void {
  if (current >= 49) {
    return
  }
  // Why: a skewed database restarts from v6, so this column may already be there.
  if (!this.hasColumn('bot_team_projects', 'code_source')) {
    this.db.exec('ALTER TABLE bot_team_projects ADD COLUMN code_source TEXT')
  }
}
