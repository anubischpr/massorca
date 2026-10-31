import { z } from 'zod'
import {
  BotTeamMessageSchema,
  BotTeamTaskSchema,
  type BotTeamMessage,
  type BotTeamMessageInput,
  type BotTeamTask,
  type BotTeamTaskInput
} from '../../../../../shared/rpc-contract/bot-team-room-params'
import { generateId } from '../generated-id'
import type { OrchestrationDb } from '../orchestration-db'

const TASK_SELECT =
  'SELECT id, team_id AS teamId, title, prompt, owner_bot_id AS ownerBotId, session_id AS sessionId FROM bot_team_tasks'
const MESSAGE_SELECT =
  'SELECT id, team_id AS teamId, author_bot_id AS authorBotId, text FROM bot_team_messages'

function requireBotOnTeam(db: OrchestrationDb, teamId: string, botId: string): void {
  const bot = db.db
    .prepare('SELECT id FROM bot_team_bots WHERE id = ? AND team_id = ?')
    .get(botId, teamId)
  if (bot === undefined) {
    throw new Error(`Bot ${botId} is not on team ${teamId}.`)
  }
}

export function createBotTeamTask(this: OrchestrationDb, input: BotTeamTaskInput): BotTeamTask {
  requireBotOnTeam(this, input.teamId, input.ownerBotId)
  const id = generateId('bottask')
  this.db
    .prepare(
      'INSERT INTO bot_team_tasks (id, team_id, title, prompt, owner_bot_id) VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, input.teamId, input.title, input.prompt, input.ownerBotId)
  return requireBotTeamTask(this, id)
}

function requireBotTeamTask(db: OrchestrationDb, taskId: string): BotTeamTask {
  const row = db.db.prepare(`${TASK_SELECT} WHERE id = ?`).get(taskId)
  if (row === undefined) {
    throw new Error(`Task ${taskId} was not found.`)
  }
  return BotTeamTaskSchema.parse(row)
}

export function listBotTeamTasks(this: OrchestrationDb, teamId: string): BotTeamTask[] {
  return z
    .array(BotTeamTaskSchema)
    .parse(this.db.prepare(`${TASK_SELECT} WHERE team_id = ? ORDER BY rowid`).all(teamId))
}

export function setBotTeamTaskSession(
  this: OrchestrationDb,
  taskId: string,
  sessionId: string
): BotTeamTask {
  this.db.prepare('UPDATE bot_team_tasks SET session_id = ? WHERE id = ?').run(sessionId, taskId)
  return requireBotTeamTask(this, taskId)
}

export function findBotTeamTaskBySession(
  this: OrchestrationDb,
  sessionId: string
): BotTeamTask | null {
  const row = this.db.prepare(`${TASK_SELECT} WHERE session_id = ?`).get(sessionId)
  return row === undefined ? null : BotTeamTaskSchema.parse(row)
}

export function postBotTeamMessage(
  this: OrchestrationDb,
  input: BotTeamMessageInput
): BotTeamMessage {
  if (input.authorBotId !== null) {
    requireBotOnTeam(this, input.teamId, input.authorBotId)
  }
  const id = generateId('botmsg')
  this.db
    .prepare('INSERT INTO bot_team_messages (id, team_id, author_bot_id, text) VALUES (?, ?, ?, ?)')
    .run(id, input.teamId, input.authorBotId, input.text)
  return BotTeamMessageSchema.parse(this.db.prepare(`${MESSAGE_SELECT} WHERE id = ?`).get(id))
}

export function listBotTeamMessages(this: OrchestrationDb, teamId: string): BotTeamMessage[] {
  return z
    .array(BotTeamMessageSchema)
    .parse(this.db.prepare(`${MESSAGE_SELECT} WHERE team_id = ? ORDER BY rowid`).all(teamId))
}

export type BotTeamRoomStoreMethods = {
  createBotTeamTask: typeof createBotTeamTask
  listBotTeamTasks: typeof listBotTeamTasks
  setBotTeamTaskSession: typeof setBotTeamTaskSession
  findBotTeamTaskBySession: typeof findBotTeamTaskBySession
  postBotTeamMessage: typeof postBotTeamMessage
  listBotTeamMessages: typeof listBotTeamMessages
}

export function attachBotTeamRoomStore(ctor: { prototype: object }): void {
  Object.assign(ctor.prototype, {
    createBotTeamTask,
    listBotTeamTasks,
    setBotTeamTaskSession,
    findBotTeamTaskBySession,
    postBotTeamMessage,
    listBotTeamMessages
  })
}
