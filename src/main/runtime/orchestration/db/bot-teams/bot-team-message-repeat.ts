import { z } from 'zod'
import type { OrchestrationDb } from '../orchestration-db'

/**
 * The id of a line this bot already posted since its latest task began, with the very same stored
 * text; null when there is none. A bot that says the same thing twice in one task adds no news.
 */
export function findRepeatedBotLine(
  db: OrchestrationDb,
  line: { teamId: string; botId: string; storedText: string }
): string | null {
  const task = db.db
    .prepare(
      'SELECT created_at FROM bot_team_tasks WHERE owner_bot_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1'
    )
    .get(line.botId)
  const since = z.object({ created_at: z.number() }).safeParse(task)
  if (!since.success) {
    return null
  }
  const found = db.db
    .prepare(
      'SELECT id FROM bot_team_messages WHERE team_id = ? AND author_bot_id = ? AND text = ? AND created_at >= ? ORDER BY rowid LIMIT 1'
    )
    .get(line.teamId, line.botId, line.storedText, since.data.created_at)
  const row = z.object({ id: z.string() }).safeParse(found)
  return row.success ? row.data.id : null
}
