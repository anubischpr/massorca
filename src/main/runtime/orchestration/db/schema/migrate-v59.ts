import type { OrchestrationDb } from '../orchestration-db'

export function migrateV59(this: OrchestrationDb, current: number): void {
  if (current >= 59) {
    return
  }
  // Why: a skewed database restarts from an older schema, so this column may already be there.
  if (!this.hasColumn('bot_team_tasks', 'last_status')) {
    // The terminal status the host last saw for the task's session; boards paint it before the feed answers.
    this.db.exec('ALTER TABLE bot_team_tasks ADD COLUMN last_status TEXT')
  }
}
