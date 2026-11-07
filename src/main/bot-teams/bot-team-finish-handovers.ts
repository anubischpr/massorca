import { z } from 'zod'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'

type DbHandle = Pick<OrchestrationDb, 'db'>

const HandOverRowSchema = z.object({
  requestId: z.string(),
  taskId: z.string().nullable(),
  childSessionId: z.string().nullable(),
  ownerBotId: z.string()
})
/** A hand-over to a teammate: a delegation row tied to the teammate's own room task. */
export type BotTeamHandOver = z.infer<typeof HandOverRowSchema>

const HAND_OVER_SELECT = `
  SELECT d.id AS requestId, d.task_id AS taskId, d.child_session_id AS childSessionId,
    t.owner_bot_id AS ownerBotId
  FROM delegation_requests d
  JOIN bot_team_task_delegations l ON l.request_id = d.id
  JOIN bot_team_tasks t ON t.id = l.task_id`

/** The teammate hand-overs a session made; each teammate reports its own files. */
export function handOversMadeBy(db: DbHandle, parentSessionId: string): BotTeamHandOver[] {
  return z
    .array(HandOverRowSchema)
    .parse(db.db.prepare(`${HAND_OVER_SELECT} WHERE d.parent_session_id = ?`).all(parentSessionId))
}

/** The hand-over a session runs as a teammate, or null for a session no teammate handed work to. */
export function handOverRunBy(db: DbHandle, childSessionId: string): BotTeamHandOver | null {
  const parsed = HandOverRowSchema.safeParse(
    db.db.prepare(`${HAND_OVER_SELECT} WHERE d.child_session_id = ?`).get(childSessionId)
  )
  return parsed.success ? parsed.data : null
}
