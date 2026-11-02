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
  'SELECT id, team_id AS teamId, title, prompt, owner_bot_id AS ownerBotId, session_id AS sessionId, project_id AS projectId FROM bot_team_tasks'
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
  linkDelegatedBotTeamTasks(this)
  return z
    .array(BotTeamTaskSchema)
    .parse(this.db.prepare(`${TASK_SELECT} WHERE team_id = ? ORDER BY rowid`).all(teamId))
}

/** A delegated task learns its session from its request, once the child has started. */
function linkDelegatedBotTeamTasks(db: OrchestrationDb): void {
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

export function setBotTeamTaskSession(
  this: OrchestrationDb,
  taskId: string,
  sessionId: string
): BotTeamTask {
  this.db
    .prepare('UPDATE bot_team_tasks SET session_id = ? WHERE id = ? AND session_id IS NULL')
    .run(sessionId, taskId)
  return requireBotTeamTask(this, taskId)
}

export function findBotTeamTaskBySession(
  this: OrchestrationDb,
  sessionId: string
): BotTeamTask | null {
  linkDelegatedBotTeamTasks(this)
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

export function getBotTeamWorkspace(this: OrchestrationDb, teamId: string): string | null {
  const row = z
    .object({ workspace_id: z.string() })
    .optional()
    .parse(
      this.db.prepare('SELECT workspace_id FROM bot_team_workspaces WHERE team_id = ?').get(teamId)
    )
  return row?.workspace_id ?? null
}

export function setBotTeamWorkspace(
  this: OrchestrationDb,
  teamId: string,
  workspaceId: string
): void {
  this.db
    .prepare('INSERT OR REPLACE INTO bot_team_workspaces (team_id, workspace_id) VALUES (?, ?)')
    .run(teamId, workspaceId)
}

export function getBotTeamTask(this: OrchestrationDb, taskId: string): BotTeamTask {
  linkDelegatedBotTeamTasks(this)
  return requireBotTeamTask(this, taskId)
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

export type BotTeamRoomStoreMethods = {
  linkBotTeamTaskDelegation: typeof linkBotTeamTaskDelegation
  getBotTeamTask: typeof getBotTeamTask
  isBotTeamTaskHandedOff: typeof isBotTeamTaskHandedOff
  getBotTeamWorkspace: typeof getBotTeamWorkspace
  setBotTeamWorkspace: typeof setBotTeamWorkspace
  createBotTeamTask: typeof createBotTeamTask
  listBotTeamTasks: typeof listBotTeamTasks
  setBotTeamTaskSession: typeof setBotTeamTaskSession
  findBotTeamTaskBySession: typeof findBotTeamTaskBySession
  postBotTeamMessage: typeof postBotTeamMessage
  listBotTeamMessages: typeof listBotTeamMessages
}

export function attachBotTeamRoomStore(ctor: { prototype: object }): void {
  Object.assign(ctor.prototype, {
    isBotTeamTaskHandedOff,
    linkBotTeamTaskDelegation,
    getBotTeamTask,
    getBotTeamWorkspace,
    setBotTeamWorkspace,
    createBotTeamTask,
    listBotTeamTasks,
    setBotTeamTaskSession,
    findBotTeamTaskBySession,
    postBotTeamMessage,
    listBotTeamMessages
  })
}
