import type { OrchestrationDb } from '../orchestration-db'

export function migrateV45(this: OrchestrationDb, current: number): void {
  if (current >= 45) {
    return
  }
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS bot_team_tasks (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES bot_teams(id),
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      owner_bot_id TEXT NOT NULL REFERENCES bot_team_bots(id),
      session_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bot_team_tasks_team ON bot_team_tasks(team_id);
    CREATE INDEX IF NOT EXISTS idx_bot_team_tasks_session ON bot_team_tasks(session_id);
    CREATE TABLE IF NOT EXISTS bot_team_messages (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES bot_teams(id),
      author_bot_id TEXT REFERENCES bot_team_bots(id),
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bot_team_messages_team ON bot_team_messages(team_id);
  `)
}
