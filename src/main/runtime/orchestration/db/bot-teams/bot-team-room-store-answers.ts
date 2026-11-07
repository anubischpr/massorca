import { z } from 'zod'
import type { BotTeamTask } from '../../../../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../orchestration-db'

const tablesMade = new WeakSet<object>()

/**
 * Made on first use, not by a schema version: a build from before it ignores the table, so a
 * downgraded database keeps working.
 */
function ensureAnswersTable(db: OrchestrationDb): void {
  if (tablesMade.has(db.db)) {
    return
  }
  db.db.exec(
    'CREATE TABLE IF NOT EXISTS bot_team_task_answers (task_id TEXT PRIMARY KEY, message_id TEXT NOT NULL)'
  )
  tablesMade.add(db.db)
}

/** Records the room message a reply task answers; the room shows that task as typing, not as a card. */
export function setBotTeamTaskAnswers(
  this: OrchestrationDb,
  taskId: string,
  messageId: string
): void {
  ensureAnswersTable(this)
  this.db
    .prepare('INSERT OR REPLACE INTO bot_team_task_answers (task_id, message_id) VALUES (?, ?)')
    .run(taskId, messageId)
}

/** The tasks that answer a room message carry `answersMessageId`; every other task is returned as it was. */
export function withAnswersMessage(db: OrchestrationDb, tasks: BotTeamTask[]): BotTeamTask[] {
  ensureAnswersTable(db)
  const answers = new Map(
    z
      .array(z.object({ task_id: z.string(), message_id: z.string() }))
      .parse(db.db.prepare('SELECT task_id, message_id FROM bot_team_task_answers').all())
      .map((row): [string, string] => [row.task_id, row.message_id])
  )
  return tasks.map((task) => {
    const messageId = answers.get(task.id)
    return messageId === undefined ? task : { ...task, answersMessageId: messageId }
  })
}

export const BOT_TEAM_TASK_ANSWERS_STORE_METHODS = { setBotTeamTaskAnswers }

export type BotTeamTaskAnswersStoreMethods = {
  setBotTeamTaskAnswers: typeof setBotTeamTaskAnswers
}
