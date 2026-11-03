import type { OrchestrationDb } from '../orchestration-db'

export function migrateV57(this: OrchestrationDb, current: number): void {
  if (current >= 57) {
    return
  }
  // Why: a skewed database restarts from v6, so either column may already be there.
  if (!this.hasColumn('bot_team_messages', 'created_at')) {
    this.db.exec('ALTER TABLE bot_team_messages ADD COLUMN created_at INTEGER')
  }
  if (!this.hasColumn('bot_team_tasks', 'created_at')) {
    this.db.exec('ALTER TABLE bot_team_tasks ADD COLUMN created_at INTEGER')
  }
  // Why: old rows keep their order and sort below any host time; old tasks sit after every old message.
  this.db.exec(`
    UPDATE bot_team_messages SET created_at = rowid WHERE created_at IS NULL;
    UPDATE bot_team_tasks SET created_at = (SELECT COALESCE(MAX(rowid), 0) FROM bot_team_messages) + rowid
      WHERE created_at IS NULL;
  `)
}
