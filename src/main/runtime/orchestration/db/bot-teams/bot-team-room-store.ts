import { z } from 'zod'
import {
  BotTeamMessageSchema,
  BotTeamTaskSchema,
  type BotTeamMessage,
  type BotTeamMessageInput,
  type BotTeamTask,
  type BotTeamTaskInput
} from '../../../../../shared/rpc-contract/bot-team-room-params'
import type { BotTeamTaskLastStatus } from '../../../../../shared/bot-team-task-status'
import { BOT_TEAM_ALL_AUTHOR } from '../../../../../shared/bot-team-greeting'
import { botTeamRoomMessageFromStored, botTeamRoomStoredText } from './bot-team-room-stored-text'
import { generateId } from '../generated-id'
import {
  hasUnstartedBotTeamDelegation,
  isBotTeamTaskHandedOff,
  linkBotTeamTaskDelegation,
  linkDelegatedBotTeamTasks
} from './bot-team-task-delegation-store'
import {
  BOT_TEAM_TASK_WAITING_STORE_METHODS,
  clearBotTeamTaskWaiting,
  clearBotTeamTaskWaitingOfSession,
  withAwaitingPerson,
  type BotTeamTaskWaitingStoreMethods
} from './bot-team-task-waiting-store'
import {
  BOT_TEAM_MEMORY_STORE_METHODS,
  type BotTeamMemoryStoreMethods
} from './bot-team-memory-store'
import {
  BOT_TEAM_TRACKER_STORE_METHODS,
  type BotTeamTrackerStoreMethods
} from './bot-team-tracker-store'
import {
  BOT_TEAM_TASK_ANSWERS_STORE_METHODS,
  withAnswersMessage,
  type BotTeamTaskAnswersStoreMethods
} from './bot-team-room-store-answers'
import { findRepeatedBotLine } from './bot-team-message-repeat'
import type { OrchestrationDb } from '../orchestration-db'

const TASK_SELECT = `SELECT id, team_id AS teamId, title, prompt, owner_bot_id AS ownerBotId, session_id AS sessionId, project_id AS projectId, created_at AS createdAt, last_status AS lastStatus,
  EXISTS (SELECT 1 FROM bot_team_routine_runs r WHERE r.task_id = bot_team_tasks.id) AS fromRoutine
  FROM bot_team_tasks`
// The greeting line has no bot row to point at, so it reads back as the All author.
const MESSAGE_SELECT = `SELECT id, team_id AS teamId, text, created_at AS createdAt,
  CASE WHEN author_kind = '${BOT_TEAM_ALL_AUTHOR}' THEN '${BOT_TEAM_ALL_AUTHOR}' ELSE author_bot_id END AS authorBotId
  FROM bot_team_messages`

function requireBotOnTeam(db: OrchestrationDb, teamId: string, botId: string): void {
  const bot = db.db
    .prepare('SELECT id FROM bot_team_bots WHERE id = ? AND team_id = ?')
    .get(botId, teamId)
  if (bot === undefined) {
    throw new Error(`Bot ${botId} is not on team ${teamId}.`)
  }
}

type BotTeamTaskCreated = (db: OrchestrationDb, task: BotTeamTask) => void
let taskCreated: BotTeamTaskCreated | null = null

/** One listener for every task made on this host, however it was made; returns its removal. */
export function onBotTeamTaskCreated(listener: BotTeamTaskCreated): () => void {
  taskCreated = listener
  return () => {
    if (taskCreated === listener) {
      taskCreated = null
    }
  }
}

export function createBotTeamTask(this: OrchestrationDb, input: BotTeamTaskInput): BotTeamTask {
  requireBotOnTeam(this, input.teamId, input.ownerBotId)
  const id = generateId('bottask')
  this.db
    .prepare(
      'INSERT INTO bot_team_tasks (id, team_id, title, prompt, owner_bot_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, input.teamId, input.title, input.prompt, input.ownerBotId, Date.now())
  const task = requireBotTeamTask(this, id)
  taskCreated?.(this, task)
  return task
}

/** Replaces a title only if it is still `from`, so a later change is never undone. */
export function renameBotTeamTask(
  db: OrchestrationDb,
  taskId: string,
  from: string,
  to: string
): void {
  db.db
    .prepare('UPDATE bot_team_tasks SET title = ? WHERE id = ? AND title = ?')
    .run(to, taskId, from)
}

function requireBotTeamTask(db: OrchestrationDb, taskId: string): BotTeamTask {
  const row = db.db.prepare(`${TASK_SELECT} WHERE id = ?`).get(taskId)
  if (row === undefined) {
    throw new Error(`Task ${taskId} was not found.`)
  }
  return withAnswersMessage(db, withAwaitingPerson(db, [BotTeamTaskSchema.parse(row)]))[0]
}

export function listBotTeamTasks(this: OrchestrationDb, teamId: string): BotTeamTask[] {
  linkDelegatedBotTeamTasks(this)
  return withAnswersMessage(
    this,
    withAwaitingPerson(
      this,
      z
        .array(BotTeamTaskSchema)
        .parse(this.db.prepare(`${TASK_SELECT} WHERE team_id = ? ORDER BY rowid`).all(teamId))
    )
  )
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

/** Keeps the terminal status of the task running this session; null clears it while the session works. */
export function setBotTeamTaskLastStatus(
  this: OrchestrationDb,
  sessionId: string,
  status: BotTeamTaskLastStatus | null
): void {
  // Why: a parent whose delegated parts never started or failed has not finished the work.
  const kept =
    status === 'Done' && hasUnstartedBotTeamDelegation(this, sessionId) ? 'Stuck' : status
  this.db
    .prepare(
      'UPDATE bot_team_tasks SET last_status = ? WHERE session_id = ? AND last_status IS NOT ?'
    )
    .run(kept, sessionId, kept)
  // Only a finished turn can wait on the person; working again, a stop or a failure ends the wait.
  if (kept !== 'Done') {
    clearBotTeamTaskWaitingOfSession(this, sessionId)
  }
}

export function findBotTeamTaskBySession(
  this: OrchestrationDb,
  sessionId: string
): BotTeamTask | null {
  linkDelegatedBotTeamTasks(this)
  const row = this.db.prepare(`${TASK_SELECT} WHERE session_id = ?`).get(sessionId)
  return row === undefined
    ? null
    : withAnswersMessage(this, withAwaitingPerson(this, [BotTeamTaskSchema.parse(row)]))[0]
}

export function postBotTeamMessage(
  this: OrchestrationDb,
  input: BotTeamMessageInput
): BotTeamMessage {
  const fromAll = input.authorBotId === BOT_TEAM_ALL_AUTHOR
  if (input.authorBotId !== null && !fromAll) {
    requireBotOnTeam(this, input.teamId, input.authorBotId)
  }
  const storedText = botTeamRoomStoredText(input)
  const repeated =
    input.authorBotId !== null && !fromAll
      ? findRepeatedBotLine(this, {
          teamId: input.teamId,
          botId: input.authorBotId,
          storedText
        })
      : null
  const id = repeated ?? generateId('botmsg')
  if (repeated === null) {
    this.db
      .prepare(
        'INSERT INTO bot_team_messages (id, team_id, author_bot_id, author_kind, text, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        id,
        input.teamId,
        fromAll ? null : input.authorBotId,
        fromAll ? BOT_TEAM_ALL_AUTHOR : null,
        storedText,
        Date.now()
      )
  }
  return botTeamRoomMessageFromStored(
    BotTeamMessageSchema.parse(this.db.prepare(`${MESSAGE_SELECT} WHERE id = ?`).get(id))
  )
}

export function listBotTeamMessages(this: OrchestrationDb, teamId: string): BotTeamMessage[] {
  const sources = this.listBotTeamReturnSources(teamId)
  return z
    .array(BotTeamMessageSchema)
    .parse(this.db.prepare(`${MESSAGE_SELECT} WHERE team_id = ? ORDER BY rowid`).all(teamId))
    .map(botTeamRoomMessageFromStored)
    .map((message) => {
      const fromTeamId = sources.get(message.id)
      return fromTeamId === undefined ? message : { ...message, fromTeamId }
    })
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

export function getBotTeamTaskStartNotes(this: OrchestrationDb, taskId: string): string | null {
  const row = z
    .object({ start_notes: z.string().nullable() })
    .optional()
    .parse(this.db.prepare('SELECT start_notes FROM bot_team_tasks WHERE id = ?').get(taskId))
  return row?.start_notes ?? null
}

export function setBotTeamTaskStartNotes(
  this: OrchestrationDb,
  taskId: string,
  notes: string | null
): void {
  this.db.prepare('UPDATE bot_team_tasks SET start_notes = ? WHERE id = ?').run(notes, taskId)
}

/**
 * Gives a task to another bot, in this team or another. Its session and delegation belong to the old
 * owner, so they are dropped and the new owner starts fresh; its project belongs to the old team.
 */
export function moveBotTeamTask(
  this: OrchestrationDb,
  taskId: string,
  to: { teamId: string; ownerBotId: string; startNotes: string | null }
): BotTeamTask {
  requireBotOnTeam(this, to.teamId, to.ownerBotId)
  this.db.exec('BEGIN')
  try {
    this.db.prepare('DELETE FROM bot_team_task_delegations WHERE task_id = ?').run(taskId)
    this.db
      .prepare(
        `UPDATE bot_team_tasks SET
           project_id = CASE WHEN team_id = ? THEN project_id ELSE NULL END,
           team_id = ?, owner_bot_id = ?, session_id = NULL, start_notes = ?
         WHERE id = ?`
      )
      .run(to.teamId, to.teamId, to.ownerBotId, to.startNotes, taskId)
    this.db.exec('COMMIT')
  } catch (error) {
    this.db.exec('ROLLBACK')
    throw error
  }
  // Its new owner starts fresh, so a question the old owner asked is not waiting any more.
  clearBotTeamTaskWaiting.call(this, taskId)
  return requireBotTeamTask(this, taskId)
}

export type BotTeamRoomStoreMethods = BotTeamMemoryStoreMethods &
  BotTeamTrackerStoreMethods &
  BotTeamTaskWaitingStoreMethods &
  BotTeamTaskAnswersStoreMethods & {
    linkBotTeamTaskDelegation: typeof linkBotTeamTaskDelegation
    getBotTeamTask: typeof getBotTeamTask
    isBotTeamTaskHandedOff: typeof isBotTeamTaskHandedOff
    getBotTeamTaskStartNotes: typeof getBotTeamTaskStartNotes
    setBotTeamTaskStartNotes: typeof setBotTeamTaskStartNotes
    moveBotTeamTask: typeof moveBotTeamTask
    getBotTeamWorkspace: typeof getBotTeamWorkspace
    setBotTeamWorkspace: typeof setBotTeamWorkspace
    createBotTeamTask: typeof createBotTeamTask
    listBotTeamTasks: typeof listBotTeamTasks
    setBotTeamTaskSession: typeof setBotTeamTaskSession
    setBotTeamTaskLastStatus: typeof setBotTeamTaskLastStatus
    findBotTeamTaskBySession: typeof findBotTeamTaskBySession
    postBotTeamMessage: typeof postBotTeamMessage
    listBotTeamMessages: typeof listBotTeamMessages
  }

export function attachBotTeamRoomStore(ctor: { prototype: object }): void {
  Object.assign(
    ctor.prototype,
    BOT_TEAM_MEMORY_STORE_METHODS,
    BOT_TEAM_TRACKER_STORE_METHODS,
    BOT_TEAM_TASK_WAITING_STORE_METHODS,
    BOT_TEAM_TASK_ANSWERS_STORE_METHODS,
    {
      isBotTeamTaskHandedOff,
      getBotTeamTaskStartNotes,
      setBotTeamTaskStartNotes,
      moveBotTeamTask,
      linkBotTeamTaskDelegation,
      getBotTeamTask,
      getBotTeamWorkspace,
      setBotTeamWorkspace,
      createBotTeamTask,
      listBotTeamTasks,
      setBotTeamTaskSession,
      setBotTeamTaskLastStatus,
      findBotTeamTaskBySession,
      postBotTeamMessage,
      listBotTeamMessages
    }
  )
}
