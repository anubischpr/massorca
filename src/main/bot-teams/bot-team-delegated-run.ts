import { z } from 'zod'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { botRunOfOptions } from '../marketplace/marketplace-bot-run-denial'

type BotRun = { botId: string; teamId: string }
type DbHandle = Pick<OrchestrationDb, 'db'>

const BotRunRowSchema = z.object({ botId: z.string(), teamId: z.string() })
const ParentRowSchema = z.object({ parent: z.string() })

// Why: the bot task a hand-over created is owned by the teammate who does the work, not the caller.
const TEAMMATE_OF_DISPATCH_SQL = `
  SELECT t.owner_bot_id AS botId, t.team_id AS teamId
  FROM dispatch_contexts c
  JOIN delegation_requests d ON d.task_id = c.task_id
  JOIN bot_team_task_delegations l ON l.request_id = d.id
  JOIN bot_team_tasks t ON t.id = l.task_id
  WHERE c.id = ?`
const PARENT_OF_DISPATCH_SQL = `
  SELECT d.parent_session_id AS parent
  FROM dispatch_contexts c
  JOIN delegation_requests d ON d.task_id = c.task_id
  WHERE c.id = ?`
const BOT_OF_TASK_SESSION_SQL = `
  SELECT owner_bot_id AS botId, team_id AS teamId FROM bot_team_tasks WHERE session_id = ?`
const BOT_OF_TEAMMATE_CHILD_SQL = `
  SELECT t.owner_bot_id AS botId, t.team_id AS teamId
  FROM delegation_requests d
  JOIN bot_team_task_delegations l ON l.request_id = d.id
  JOIN bot_team_tasks t ON t.id = l.task_id
  WHERE d.child_session_id = ?`
const PARENT_OF_CHILD_SQL = `
  SELECT parent_session_id AS parent FROM delegation_requests WHERE child_session_id = ?`

/** Deeper than any real chain of hand-overs; a loop in the rows stops here. */
const MAX_LINEAGE_DEPTH = 16

function botRow(db: DbHandle, sql: string, key: string): BotRun | null {
  const parsed = BotRunRowSchema.safeParse(db.db.prepare(sql).get(key))
  return parsed.success ? parsed.data : null
}

function parentRow(db: DbHandle, sql: string, key: string): string | null {
  const parsed = ParentRowSchema.safeParse(db.db.prepare(sql).get(key))
  return parsed.success ? parsed.data.parent : null
}

/** The bot whose run a session belongs to by the rows alone: its own task, or the chain it descends from. */
function botRunOfSessionRows(db: DbHandle, start: string | null): BotRun | null {
  let session = start
  for (let depth = 0; session !== null && depth < MAX_LINEAGE_DEPTH; depth += 1) {
    const bot =
      botRow(db, BOT_OF_TASK_SESSION_SQL, session) ?? botRow(db, BOT_OF_TEAMMATE_CHILD_SQL, session)
    if (bot) {
      return bot
    }
    session = parentRow(db, PARENT_OF_CHILD_SQL, session)
  }
  return null
}

/**
 * The bot a delegated dispatch runs for, or null when it descends from no bot. A hand-over to a
 * teammate runs as that teammate; any other child of a bot's session, however deep, keeps the
 * restrictions of the bot whose session started the chain, so delegating cannot shed them.
 */
export function botRunOfDelegatedDispatch(db: DbHandle, dispatchId: string): BotRun | null {
  return (
    botRow(db, TEAMMATE_OF_DISPATCH_SQL, dispatchId) ??
    botRunOfSessionRows(db, parentRow(db, PARENT_OF_DISPATCH_SQL, dispatchId))
  )
}

/**
 * The bot a calling session belongs to: the marker its own record carries (every bot run has one),
 * else the rows that tie it to a bot task. A worker it starts directly inherits this bot.
 */
export function botRunOfCallerSession(
  db: DbHandle,
  sessionId: string | null | undefined,
  readOptions: (sessionId: string) => Readonly<Record<string, string>> | undefined
): BotRun | null {
  if (!sessionId) {
    return null
  }
  return botRunOfOptions(readOptions(sessionId)) ?? botRunOfSessionRows(db, sessionId)
}
