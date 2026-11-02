import type { OrchestrationDb } from '../orchestration-db'

export function migrateV51(this: OrchestrationDb, current: number): void {
  if (current >= 51) {
    return
  }
  // Why: a skewed database restarts from v6, so this column may already be there.
  if (!this.hasColumn('bot_team_messages', 'author_kind')) {
    // Marks the team's greeting line, which no single bot wrote; the bot column stays null.
    this.db.exec('ALTER TABLE bot_team_messages ADD COLUMN author_kind TEXT')
  }
}
