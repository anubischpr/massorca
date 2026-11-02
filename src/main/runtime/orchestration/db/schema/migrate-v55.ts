import type { OrchestrationDb } from '../orchestration-db'

export function migrateV55(this: OrchestrationDb, current: number): void {
  if (current >= 55) {
    return
  }
  // Why: only the hash of a secret is kept, and no foreign keys so deleting a team never fails on an address.
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS bot_team_webhooks (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      secret_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_call_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_bot_team_webhooks_team ON bot_team_webhooks(team_id);
  `)
}
