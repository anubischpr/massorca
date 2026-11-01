import type { OrchestrationDb } from '../orchestration-db'

export function migrateV47(this: OrchestrationDb, current: number): void {
  if (current >= 47) {
    return
  }
  this.db.exec(`
    ALTER TABLE bot_team_bots ADD COLUMN model_mode TEXT NOT NULL DEFAULT 'auto';
    ALTER TABLE bot_team_bots ADD COLUMN model TEXT;
    ALTER TABLE bot_team_bots ADD COLUMN effort TEXT;
    ALTER TABLE bot_team_bots ADD COLUMN skills TEXT NOT NULL DEFAULT '[]';
  `)
}
