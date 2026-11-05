import { z } from 'zod'
import type { BotTeamTask } from '../../../../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../orchestration-db'

const tablesMade = new WeakSet<object>()

/**
 * Made on first use, not by a schema version: a build from before it ignores the table, so a
 * downgraded database keeps working.
 */
function ensureWaitingTable(db: OrchestrationDb): void {
  if (tablesMade.has(db.db)) {
    return
  }
  db.db.exec(
    'CREATE TABLE IF NOT EXISTS bot_team_task_waiting (task_id TEXT PRIMARY KEY, since INTEGER NOT NULL)'
  )
  tablesMade.add(db.db)
}

/** The tasks flagged with `awaitingPerson`; every other task is returned as it was. */
export function withAwaitingPerson(db: OrchestrationDb, tasks: BotTeamTask[]): BotTeamTask[] {
  ensureWaitingTable(db)
  const waiting = new Set(
    z
      .array(z.object({ task_id: z.string() }))
      .parse(db.db.prepare('SELECT task_id FROM bot_team_task_waiting').all())
      .map((row) => row.task_id)
  )
  return tasks.map((task) => (waiting.has(task.id) ? { ...task, awaitingPerson: true } : task))
}

/** The bot ended its turn on a question: the task waits for the person instead of reading Done. */
export function markBotTeamTaskWaiting(
  this: OrchestrationDb,
  taskId: string,
  now: number = Date.now()
): void {
  ensureWaitingTable(this)
  this.db
    .prepare('INSERT OR REPLACE INTO bot_team_task_waiting (task_id, since) VALUES (?, ?)')
    .run(taskId, now)
}

export function clearBotTeamTaskWaiting(this: OrchestrationDb, taskId: string): void {
  ensureWaitingTable(this)
  this.db.prepare('DELETE FROM bot_team_task_waiting WHERE task_id = ?').run(taskId)
}

/** A session that works again, stops or fails is no longer waiting on the person. */
export function clearBotTeamTaskWaitingOfSession(db: OrchestrationDb, sessionId: string): void {
  ensureWaitingTable(db)
  db.db
    .prepare(
      'DELETE FROM bot_team_task_waiting WHERE task_id IN (SELECT id FROM bot_team_tasks WHERE session_id = ?)'
    )
    .run(sessionId)
}

/** A team's tasks that wait for the person, the one that began waiting last first. */
export function listWaitingBotTeamTasks(
  this: OrchestrationDb,
  teamId: string
): { task: BotTeamTask; since: number }[] {
  ensureWaitingTable(this)
  const rows = z.array(z.object({ task_id: z.string(), since: z.number() })).parse(
    this.db
      .prepare(
        `SELECT w.task_id, w.since FROM bot_team_task_waiting w
           JOIN bot_team_tasks t ON t.id = w.task_id
           WHERE t.team_id = ? ORDER BY w.since DESC, w.rowid DESC`
      )
      .all(teamId)
  )
  return rows.map((row) => ({ task: this.getBotTeamTask(row.task_id), since: row.since }))
}

export const BOT_TEAM_TASK_WAITING_STORE_METHODS = {
  markBotTeamTaskWaiting,
  clearBotTeamTaskWaiting,
  listWaitingBotTeamTasks
}

export type BotTeamTaskWaitingStoreMethods = {
  [
    K in keyof typeof BOT_TEAM_TASK_WAITING_STORE_METHODS
  ]: (typeof BOT_TEAM_TASK_WAITING_STORE_METHODS)[K]
}
