import { z } from 'zod'
import { BOT_TEAM_CHARACTERS } from '../../shared/rpc-contract/bot-team-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'

export type BotTeamSessionTeam = {
  teamId: string
  teamName: string
  character: (typeof BOT_TEAM_CHARACTERS)[number]
}

const TeamSessionRowSchema = z.object({
  sessionId: z.string(),
  teamId: z.string(),
  teamName: z.string(),
  character: z.enum(BOT_TEAM_CHARACTERS)
})

const TASK_SESSION_ROWS_SQL = `
  SELECT t.session_id AS sessionId, b.id AS teamId, b.name AS teamName, b.character AS character
  FROM bot_team_tasks t
  JOIN bot_teams b ON b.id = t.team_id
  WHERE t.session_id IS NOT NULL
  UNION
  SELECT d.child_session_id AS sessionId, b.id AS teamId, b.name AS teamName, b.character AS character
  FROM bot_team_task_delegations l
  JOIN delegation_requests d ON d.id = l.request_id
  JOIN bot_team_tasks t ON t.id = l.task_id
  JOIN bot_teams b ON b.id = t.team_id
  WHERE d.child_session_id IS NOT NULL`

/**
 * Every session a bot-team task started, plus the sessions delegated beneath each one,
 * keyed by session id. Read from the task link, never from a session's name.
 */
export function listBotTeamSessionTeams(db: OrchestrationDb): Record<string, BotTeamSessionTeam> {
  const rows = TeamSessionRowSchema.array().parse(db.db.prepare(TASK_SESSION_ROWS_SQL).all())
  const childrenOf = db.db.prepare(
    'SELECT child_session_id AS childId FROM delegation_requests WHERE parent_session_id = ? AND child_session_id IS NOT NULL'
  )
  const teamBySession: Record<string, BotTeamSessionTeam> = {}
  for (const row of rows) {
    const team: BotTeamSessionTeam = {
      teamId: row.teamId,
      teamName: row.teamName,
      character: row.character
    }
    const pending = [row.sessionId]
    let sessionId = pending.pop()
    while (sessionId !== undefined) {
      if (teamBySession[sessionId] === undefined) {
        teamBySession[sessionId] = team
        const children = z.array(z.object({ childId: z.string() })).parse(childrenOf.all(sessionId))
        pending.push(...children.map((child) => child.childId))
      }
      sessionId = pending.pop()
    }
  }
  return teamBySession
}
