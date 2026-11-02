import type { OrchestrationDb } from '../orchestration-db'

const BOT_COLUMNS = [
  ['model_mode', "TEXT NOT NULL DEFAULT 'auto'"],
  ['model', 'TEXT'],
  ['effort', 'TEXT'],
  ['skills', "TEXT NOT NULL DEFAULT '[]'"]
] as const

export function migrateV47(this: OrchestrationDb, current: number): void {
  if (current >= 47) {
    return
  }
  // Why: a skewed database restarts from v6, so these columns may already be there.
  for (const [column, definition] of BOT_COLUMNS) {
    if (!this.hasColumn('bot_team_bots', column)) {
      this.db.exec(`ALTER TABLE bot_team_bots ADD COLUMN ${column} ${definition}`)
    }
  }
}
