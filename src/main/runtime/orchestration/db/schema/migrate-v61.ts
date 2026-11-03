import type { OrchestrationDb } from '../orchestration-db'

export function migrateV61(this: OrchestrationDb, current: number): void {
  if (current >= 61) {
    return
  }
  // Why: a skewed database restarts from an older schema, so the column may already be there.
  if (!this.hasColumn('bot_team_routines', 'run_date')) {
    this.db.exec('ALTER TABLE bot_team_routines ADD COLUMN run_date TEXT')
  }
  // Null keeps a routine from before zones on the host's clock.
  if (!this.hasColumn('bot_team_routines', 'time_zone')) {
    this.db.exec('ALTER TABLE bot_team_routines ADD COLUMN time_zone TEXT')
  }
}
