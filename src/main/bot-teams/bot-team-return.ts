import { existsSync } from 'node:fs'
import path from 'node:path'
import { pickBotTeamLine, botTeamReplyLanguage } from '../../shared/bot-team-reply-language'
import {
  BOT_TEAM_ROOM_ATTACHMENT_LIMIT,
  type BotTeamRoomAttachment
} from '../../shared/bot-team-room-attachments'
import type { BotTeamMessage } from '../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { copyBotTeamDeliverables, listBotTeamDeliverables } from './bot-team-deliverables'
import {
  botTeamDeliverableStoreDir,
  recordFinishedTaskDeliverables
} from './bot-team-deliverables-record'
import { botTeamFolderPath } from './bot-team-version-deps'
import {
  readWorktreeChanges,
  splitWorktreeFiles,
  worktreeOfWorkspace
} from './bot-team-worktree-deliverables'

export type BotTeamReturnDeps = {
  folderOf: (teamId: string) => string
  /** The bot posts its finish line from its own session, which can land just after the status flips. */
  settleMs: number
  /** The workspace the finished session ran in, as the host's status feed names it; null when unseen. */
  sessionWorkspaceId?: string | null
  /** Where finished tasks' file records are kept; the app's data folder when not given. */
  deliverableStoreDir?: string
}

const DEFAULT_DEPS: BotTeamReturnDeps = { folderOf: botTeamFolderPath, settleMs: 3000 }

/** The deps for a finish of a session that ran in `sessionWorkspaceId`. */
export function botTeamReturnDeps(sessionWorkspaceId: string | null): BotTeamReturnDeps {
  return { ...DEFAULT_DEPS, sessionWorkspaceId }
}

const FINISHED = {
  en: (bot: string, title: string) => `${bot} finished "${title}".`,
  es: (bot: string, title: string) => `${bot} terminó "${title}".`
}

const NOT_STARTED = {
  en: (bot: string, title: string) => `${bot} could not start "${title}".`,
  es: (bot: string, title: string) => `${bot} no pudo iniciar "${title}".`
}

const WORKTREE_LINK = {
  en: (branch: string | null, where: string) =>
    branch === null ? `Work is in ${where}.` : `Work is on branch ${branch}, in ${where}.`,
  es: (branch: string | null, where: string) =>
    branch === null
      ? `El trabajo está en ${where}.`
      : `El trabajo está en la rama ${branch}, en ${where}.`
}

const NOT_COPIED = {
  en: (names: string) => `Not copied: ${names}.`,
  es: (names: string) => `No se copiaron: ${names}.`
}

/** A reason is added to the unstarted notice only when it is this short. */
const MAX_REASON_CHARS = 160

type Delivered = { attachments: BotTeamRoomAttachment[]; note: string | null }

/** Copies what a folder holds that was written since the task began, as the team folder's are. */
function copyFolderFiles(
  deps: BotTeamReturnDeps,
  folder: string,
  args: { fromTeamName: string; copyTo: string | null; since: number }
): BotTeamRoomAttachment[] {
  if (args.copyTo === null) {
    return []
  }
  try {
    return copyBotTeamDeliverables({
      fromFolder: folder,
      relativePaths: listBotTeamDeliverables(folder, args.since),
      fromTeamName: args.fromTeamName,
      toFolder: deps.folderOf(args.copyTo)
    })
  } catch (error) {
    console.warn('[bot-teams] could not copy a folder project file', error)
    return []
  }
}

/**
 * The files a finished task hands the asking team: what a git worktree changed, linked by branch and
 * folder; a folder project's files written since the task began; else the team folder's, as before.
 */
async function deliverFiles(
  deps: BotTeamReturnDeps,
  args: {
    fromTeamId: string
    fromTeamName: string
    /** The asking team, when it still exists: nothing is copied without it. */
    copyTo: string | null
    since: number
    language: ReturnType<typeof botTeamReplyLanguage>
  }
): Promise<Delivered> {
  const worktree = deps.sessionWorkspaceId ? worktreeOfWorkspace(deps.sessionWorkspaceId) : null
  if (worktree === null) {
    if (args.copyTo === null) {
      return { attachments: [], note: null }
    }
    const fromFolder = deps.folderOf(args.fromTeamId)
    return {
      attachments: copyBotTeamDeliverables({
        fromFolder,
        relativePaths: listBotTeamDeliverables(fromFolder, args.since),
        fromTeamName: args.fromTeamName,
        toFolder: deps.folderOf(args.copyTo)
      }),
      note: null
    }
  }
  const changes = worktree.local ? await readWorktreeChanges(worktree.path) : null
  const link = pickBotTeamLine(WORKTREE_LINK, args.language)(changes?.branch ?? null, worktree.path)
  if (changes === null) {
    // A folder project that is not a git checkout has no branch to diff, so its files are listed by time.
    const folderProject = worktree.local && !existsSync(path.join(worktree.path, '.git'))
    return {
      attachments: folderProject ? copyFolderFiles(deps, worktree.path, args) : [],
      note: link
    }
  }
  const split =
    args.copyTo === null
      ? { copy: [], linked: changes.files }
      : splitWorktreeFiles(worktree.path, changes.files, BOT_TEAM_ROOM_ATTACHMENT_LIMIT)
  let attachments: BotTeamRoomAttachment[] = []
  let linked = split.linked
  if (args.copyTo !== null) {
    try {
      attachments = copyBotTeamDeliverables({
        fromFolder: worktree.path,
        relativePaths: split.copy,
        fromTeamName: args.fromTeamName,
        toFolder: deps.folderOf(args.copyTo)
      })
    } catch (error) {
      console.warn('[bot-teams] could not copy a finished task file', error)
      linked = [...split.copy, ...split.linked]
    }
  }
  const notCopied =
    linked.length > 0 ? pickBotTeamLine(NOT_COPIED, args.language)(linked.join(', ')) : null
  return { attachments, note: [link, notCopied].filter((part) => part !== null).join('\n') }
}

/** Keeps where a finished task of a project ran, so the team's Files can list what it changed there. */
function recordFinishedDeliverables(
  task: { id: string; teamId: string; projectId: string | null; createdAt?: number | null },
  deps: BotTeamReturnDeps
): void {
  try {
    recordFinishedTaskDeliverables({
      storeDir: deps.deliverableStoreDir ?? botTeamDeliverableStoreDir(),
      taskId: task.id,
      teamId: task.teamId,
      projectId: task.projectId,
      workspaceId: deps.sessionWorkspaceId ?? null,
      location: deps.sessionWorkspaceId ? worktreeOfWorkspace(deps.sessionWorkspaceId) : null,
      since: task.createdAt ?? Date.now(),
      now: Date.now()
    })
  } catch (error) {
    console.warn('[bot-teams] recording the files of a finished task failed', error)
  }
}

/**
 * When a task another team asked for finishes, tells that team's room once: the bot's finish line
 * and the files it made, copied into the asking team's folder.
 */
export async function returnFinishedBotTeamTask(
  db: OrchestrationDb,
  sessionId: string,
  deps: BotTeamReturnDeps = DEFAULT_DEPS
): Promise<void> {
  const task = db.findBotTeamTaskBySession(sessionId)
  if (task) {
    recordFinishedDeliverables(task, deps)
  }
  const origin = task ? db.getBotTeamTaskOrigin(task.id) : null
  if (!task || !origin || db.hasBotTeamReturn(task.id)) {
    return
  }
  if (deps.settleMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, deps.settleMs))
  }
  const since = task.createdAt ?? Number.POSITIVE_INFINITY
  // Another finish event may have returned it during the wait, or the bot wrote in the asking room itself.
  if (
    db.hasBotTeamReturn(task.id) ||
    db
      .listBotTeamMessages(origin.teamId)
      .some(
        (m) => m.authorBotId === task.ownerBotId && !m.fromTeamId && (m.createdAt ?? 0) >= since
      )
  ) {
    return
  }
  const teams = db.listBotTeams()
  const fromTeam = teams.find((team) => team.id === task.teamId)
  const owner = fromTeam?.bots.find((bot) => bot.id === task.ownerBotId)
  if (!fromTeam || !owner) {
    return
  }
  const language = botTeamReplyLanguage({ text: task.prompt })
  const line = db
    .listBotTeamMessages(task.teamId)
    .findLast((m) => m.authorBotId === owner.id && (m.createdAt ?? 0) >= since)?.text
  const text = line?.trim() || pickBotTeamLine(FINISHED, language)(owner.name, task.title)
  const toTeam = teams.find((team) => team.id === origin.teamId)
  const delivered = await deliverFiles(deps, {
    fromTeamId: fromTeam.id,
    fromTeamName: fromTeam.name,
    copyTo: toTeam ? origin.teamId : null,
    since,
    language
  })
  db.postBotTeamReturn({
    teamId: origin.teamId,
    fromTeamId: task.teamId,
    fromTaskId: task.id,
    authorBotId: owner.id,
    text: [text, delivered.note].filter((part) => part !== null).join('\n'),
    attachments: delivered.attachments
  })
}

// Why: `bot_team_returns` holds one row per task key; the notice must not take the finish's row.
const unstartedReturnKey = (taskId: string): string => `${taskId}:unstarted`

/**
 * Tells the asking room once that a task another team asked for did not start, so the room is not
 * left waiting; the reason follows when it is short. It is kept under its own key, so a later finish of
 * the same task still reports to the asking room.
 */
export function returnUnstartedBotTeamTask(
  db: OrchestrationDb,
  taskId: string,
  reason: string
): BotTeamMessage | null {
  const task = db.getBotTeamTask(taskId)
  const origin = db.getBotTeamTaskOrigin(taskId)
  const notice = unstartedReturnKey(taskId)
  if (!origin || db.hasBotTeamReturn(notice) || db.hasBotTeamReturn(taskId)) {
    return null
  }
  const owner = db
    .listBotTeams()
    .find((team) => team.id === task.teamId)
    ?.bots.find((bot) => bot.id === task.ownerBotId)
  if (!owner) {
    return null
  }
  const line = pickBotTeamLine(NOT_STARTED, botTeamReplyLanguage({ text: task.prompt }))(
    owner.name,
    task.title
  )
  const why = reason.trim()
  return db.postBotTeamReturn({
    teamId: origin.teamId,
    fromTeamId: task.teamId,
    fromTaskId: notice,
    authorBotId: owner.id,
    text: why !== '' && why.length <= MAX_REASON_CHARS ? `${line} ${why}` : line,
    attachments: []
  })
}
