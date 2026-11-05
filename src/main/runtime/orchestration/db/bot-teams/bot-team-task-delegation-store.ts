import { z } from 'zod'
import type { BotTeamTask } from '../../../../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../orchestration-db'

/** A delegated task learns its session from its request, once the child has started. */
export function linkDelegatedBotTeamTasks(db: OrchestrationDb): void {
  db.db.exec(`
    UPDATE bot_team_tasks SET session_id = (
      SELECT d.child_session_id FROM delegation_requests d
      JOIN bot_team_task_delegations l ON l.request_id = d.id
      WHERE l.task_id = bot_team_tasks.id
    )
    WHERE session_id IS NULL
      AND id IN (SELECT task_id FROM bot_team_task_delegations)
  `)
}

export function linkBotTeamTaskDelegation(
  this: OrchestrationDb,
  taskId: string,
  requestId: string
): void {
  this.db
    .prepare('INSERT INTO bot_team_task_delegations (task_id, request_id) VALUES (?, ?)')
    .run(taskId, requestId)
}

export function hasUnstartedBotTeamDelegation(
  db: OrchestrationDb,
  parentSessionId: string
): boolean {
  return (
    db.db
      .prepare(
        `SELECT 1 FROM delegation_requests d
         JOIN bot_team_task_delegations l ON l.request_id = d.id
         WHERE d.parent_session_id = ? AND d.status IN ('pending', 'failed', 'cancelled') LIMIT 1`
      )
      .get(parentSessionId) !== undefined
  )
}

/** A teammate's child is on its way: starting the task as well would run it twice. */
export function isBotTeamTaskHandedOff(this: OrchestrationDb, taskId: string): boolean {
  return (
    this.db
      .prepare(
        `SELECT 1 FROM bot_team_task_delegations l
         JOIN delegation_requests d ON d.id = l.request_id
         WHERE l.task_id = ? AND d.status IN ('pending', 'starting')`
      )
      .get(taskId) !== undefined
  )
}

/**
 * The task this session already handed to this teammate with the very same text, unless that
 * request failed or was cancelled (those never started, so asking again is a retry).
 */
export function findHandedOverBotTeamTask(
  db: OrchestrationDb,
  args: { parentSessionId: string; ownerBotId: string; prompt: string }
): BotTeamTask | null {
  const row = db.db
    .prepare(
      `SELECT t.id FROM bot_team_task_delegations l
       JOIN delegation_requests d ON d.id = l.request_id
       JOIN bot_team_tasks t ON t.id = l.task_id
       WHERE d.parent_session_id = ? AND t.owner_bot_id = ? AND t.prompt = ?
         AND d.status NOT IN ('failed', 'cancelled')
       ORDER BY t.rowid LIMIT 1`
    )
    .get(args.parentSessionId, args.ownerBotId, args.prompt)
  const found = z.object({ id: z.string() }).safeParse(row)
  return found.success ? db.getBotTeamTask(found.data.id) : null
}
