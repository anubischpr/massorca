import type { OrchestrationDb } from '../orchestration-db'

export function migrateV52(this: OrchestrationDb, current: number): void {
  if (current >= 52) {
    return
  }
  // Why: a skewed database restarts from v6, so this column may already be there.
  if (!this.hasColumn('bot_team_tasks', 'start_notes')) {
    // What the owner reads when the task starts: a hand-over, or the bots a composite task needs.
    this.db.exec('ALTER TABLE bot_team_tasks ADD COLUMN start_notes TEXT')
  }
}
