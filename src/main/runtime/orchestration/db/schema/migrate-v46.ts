import type { OrchestrationDb } from '../orchestration-db'

export function migrateV46(this: OrchestrationDb, current: number): void {
  if (current >= 46) {
    return
  }
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS bot_team_task_delegations (
      task_id TEXT PRIMARY KEY REFERENCES bot_team_tasks(id),
      request_id TEXT NOT NULL
    );
  `)
}
