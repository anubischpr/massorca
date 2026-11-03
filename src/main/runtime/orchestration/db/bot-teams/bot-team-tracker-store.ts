import { z } from 'zod'
import {
  encodeBotTeamRoomAttachments,
  type BotTeamRoomAttachment
} from '../../../../../shared/bot-team-room-attachments'
import type {
  BotTeamMessage,
  BotTeamTask
} from '../../../../../shared/rpc-contract/bot-team-room-params'
import { generateId } from '../generated-id'
import type { OrchestrationDb } from '../orchestration-db'

/** A task another team holds for a request this team sent, with the message that asked for it. */
export type BotTeamSentRequest = { task: BotTeamTask; messageId: string | null }

const OriginRow = z.object({ origin_team_id: z.string(), origin_message_id: z.string().nullable() })

/** Keeps which team and message a task came from; the first request to reach a task wins. */
export function setBotTeamTaskOrigin(
  this: OrchestrationDb,
  taskId: string,
  originTeamId: string,
  originMessageId: string | null
): void {
  this.db
    .prepare(
      'INSERT OR IGNORE INTO bot_team_task_origins (task_id, origin_team_id, origin_message_id) VALUES (?, ?, ?)'
    )
    .run(taskId, originTeamId, originMessageId)
}

export function getBotTeamTaskOrigin(
  this: OrchestrationDb,
  taskId: string
): { teamId: string; messageId: string | null } | null {
  const row = this.db
    .prepare(
      'SELECT origin_team_id, origin_message_id FROM bot_team_task_origins WHERE task_id = ?'
    )
    .get(taskId)
  if (row === undefined) {
    return null
  }
  const parsed = OriginRow.parse(row)
  return { teamId: parsed.origin_team_id, messageId: parsed.origin_message_id }
}

/** The tasks other teams took for this team's requests, oldest first. */
export function listBotTeamSentRequests(
  this: OrchestrationDb,
  originTeamId: string
): BotTeamSentRequest[] {
  const rows = z
    .array(z.object({ task_id: z.string(), origin_message_id: z.string().nullable() }))
    .parse(
      this.db
        .prepare(
          'SELECT task_id, origin_message_id FROM bot_team_task_origins WHERE origin_team_id = ? ORDER BY rowid'
        )
        .all(originTeamId)
    )
  const sent: BotTeamSentRequest[] = []
  for (const row of rows) {
    try {
      const task = this.getBotTeamTask(row.task_id)
      if (task.teamId !== originTeamId) {
        sent.push({ task, messageId: row.origin_message_id })
      }
    } catch {
      // The task was deleted: its card goes with it.
    }
  }
  return sent
}

export function hasBotTeamReturn(this: OrchestrationDb, taskId: string): boolean {
  return (
    this.db.prepare('SELECT 1 FROM bot_team_returns WHERE from_task_id = ?').get(taskId) !==
    undefined
  )
}

/** Posts the result of a task into the team that asked for it, once; null when it already came back. */
export function postBotTeamReturn(
  this: OrchestrationDb,
  input: {
    teamId: string
    fromTeamId: string
    fromTaskId: string
    authorBotId: string
    text: string
    attachments: readonly BotTeamRoomAttachment[]
  }
): BotTeamMessage | null {
  if (this.hasBotTeamReturn(input.fromTaskId)) {
    return null
  }
  const id = generateId('botmsg')
  this.db
    .prepare(
      'INSERT INTO bot_team_messages (id, team_id, author_bot_id, author_kind, text, created_at) VALUES (?, ?, ?, NULL, ?, ?)'
    )
    .run(
      id,
      input.teamId,
      input.authorBotId,
      encodeBotTeamRoomAttachments(input.text, input.attachments),
      Date.now()
    )
  this.db
    .prepare(
      'INSERT INTO bot_team_returns (message_id, from_team_id, from_task_id) VALUES (?, ?, ?)'
    )
    .run(id, input.fromTeamId, input.fromTaskId)
  const posted = this.listBotTeamMessages(input.teamId).find((message) => message.id === id)
  return posted ?? null
}

/** The teams the returned messages of a room came from, by message id. */
export function listBotTeamReturnSources(
  this: OrchestrationDb,
  teamId: string
): Map<string, string> {
  const rows = z
    .array(z.object({ message_id: z.string(), from_team_id: z.string() }))
    .parse(
      this.db
        .prepare(
          'SELECT r.message_id, r.from_team_id FROM bot_team_returns r JOIN bot_team_messages m ON m.id = r.message_id WHERE m.team_id = ?'
        )
        .all(teamId)
    )
  return new Map(rows.map((row) => [row.message_id, row.from_team_id]))
}

export const BOT_TEAM_TRACKER_STORE_METHODS = {
  setBotTeamTaskOrigin,
  getBotTeamTaskOrigin,
  listBotTeamSentRequests,
  hasBotTeamReturn,
  postBotTeamReturn,
  listBotTeamReturnSources
}

export type BotTeamTrackerStoreMethods = {
  [K in keyof typeof BOT_TEAM_TRACKER_STORE_METHODS]: (typeof BOT_TEAM_TRACKER_STORE_METHODS)[K]
}
