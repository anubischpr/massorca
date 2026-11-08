import path from 'node:path'
import { pickBotTeamLine, botTeamReplyLanguage } from '../../shared/bot-team-reply-language'
import {
  BOT_TEAM_ROOM_ATTACHMENT_LIMIT,
  type BotTeamRoomAttachment
} from '../../shared/bot-team-room-attachments'
import { botTeamFilesOnlyText } from '../../shared/bot-team-room-attachments-line'
import { PROTOTYPE_FOLDER } from '../../shared/prototype-request-folder'
import type {
  DelegationRequestRow,
  DelegationRequestStatus
} from '../runtime/orchestration/db/delegation/delegation-request-store'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { copyBotTeamDeliverables, listBotTeamDeliverables } from './bot-team-deliverables'
import type { DeliverableFile } from './bot-team-deliverables-copyable'
import { namedFilesIn, type NamedFileRoot } from './bot-team-named-files'
import {
  childFilesOf,
  fileKey,
  filesListedBy,
  NO_SKIPPED_FOLDERS,
  TEAM_FOLDER_SKIPPED,
  teammateFilesOf
} from './bot-team-finish-child-files'
import { registerFinishedTaskFiles } from './bot-team-finish-register-files'
import { handOverRunBy, handOversMadeBy } from './bot-team-finish-handovers'
import { botTeamFolderPath } from './bot-team-version-deps'
import { isGitMainCheckout, listRecentWorkspaceFiles } from './bot-team-workspace-scan'
import {
  listRecentUntrackedFiles,
  readWorktreeChanges,
  splitDeliverableFiles,
  worktreeOfWorkspace
} from './bot-team-worktree-deliverables'

export type BotTeamFinishReportDeps = {
  folderOf: (teamId: string) => string
  /** The bot posts its finish line from its own session, which can land just after the status flips. */
  settleMs: number
  sessionWorkspaceId?: string | null
  worktreeOf?: typeof worktreeOfWorkspace
  changesOf?: typeof readWorktreeChanges
  /** A session's chat-visuals folder, where its interactive pages are written (the visuals resolver names it). */
  visualsFolderOf?: (sessionId: string) => string
  /** The workspace a session ran in, from its chat record; a finished child's files are read from there. */
  workspaceOfSession?: (sessionId: string) => string | null
  /** Where finished tasks' file records are kept; the app's own store by default. */
  deliverableStoreDir?: string
}

const MAX_NAMED = 6

const DELIVERED = {
  en: (title: string, where: string, names: string) =>
    `Deliverable of "${title}": ${where}${names === '' ? '' : ` (${names})`}.`,
  es: (title: string, where: string, names: string) =>
    `Entregable de "${title}": ${where}${names === '' ? '' : ` (${names})`}.`
}

const IN_FOLDER = { en: "the team's Files", es: 'los Archivos del equipo' }

/**
 * Where a finished task left its work: its worktree and branch, else the team folder's new files.
 * A local worktree's names are its git changes plus the files its folder shows were written since the task began.
 */
async function deliverableOf(
  deps: BotTeamFinishReportDeps,
  teamId: string,
  since: number,
  run: { sessionId: string; listed: string[] | null }
): Promise<{ where: string | null; names: string[]; worktreePath: string | null }> {
  const worktreeOf = deps.worktreeOf ?? worktreeOfWorkspace
  const workspaceId = deps.sessionWorkspaceId ?? deps.workspaceOfSession?.(run.sessionId) ?? null
  const worktree = workspaceId ? worktreeOf(workspaceId) : null
  if (worktree === null) {
    const names = listBotTeamDeliverables(deps.folderOf(teamId), since)
    return { where: null, names, worktreePath: null }
  }
  // Why: an SSH worktree's files live on the host that runs its session; this process cannot read them.
  if (!worktree.local) {
    return { where: worktree.path, names: [], worktreePath: null }
  }
  // Why: a teammate shares the lead's worktree, so only the files its own report lists are its work.
  if (run.listed !== null) {
    const names = run.listed.flatMap((file) => {
      const relative = path.isAbsolute(file) ? path.relative(worktree.path, file) : file
      return relative === '' || relative.startsWith('..') || path.isAbsolute(relative)
        ? []
        : [relative.split(path.sep).join('/')]
    })
    return { where: worktree.path, names, worktreePath: worktree.path }
  }
  const changes = await (deps.changesOf ?? readWorktreeChanges)(worktree.path)
  // Why: git lists nothing it ignores (a docs/ folder usually is), and a folder project has no git list at all.
  const scanned = isGitMainCheckout(worktree.path)
    ? []
    : await listRecentUntrackedFiles(worktree.path, since)
  const branch = changes ? `${changes.branch}, ` : ''
  return {
    where: `${branch}${worktree.path}`,
    names: [...new Set([...(changes?.files ?? []), ...scanned])],
    worktreePath: worktree.path
  }
}

/** A parent's delegations still running hold its report; refused, failed and cancelled ones are done. */
const OPEN_DELEGATION_STATUSES: readonly DelegationRequestStatus[] = [
  'pending',
  'starting',
  'started'
]
/** A child still launching or running holds the report; one stuck on a card no person answers does not. */
function holdsReport(request: DelegationRequestRow): boolean {
  return request.status !== 'pending' || request.question_item_id === null
}
const HTML_FILE = /\.html$/i

/** The HTML pages a session wrote into its chat-visuals folder since its task began. */
function visualFilesOf(
  deps: BotTeamFinishReportDeps,
  sessionId: string,
  since: number
): DeliverableFile[] {
  const folder = deps.visualsFolderOf?.(sessionId)
  if (folder === undefined) {
    return []
  }
  // Why: a prototype shows as its own link in the room, never as a file in Files.
  return listRecentWorkspaceFiles(
    folder,
    since,
    new Set(),
    (relative) => HTML_FILE.test(relative) && !relative.startsWith(`${PROTOTYPE_FOLDER}/`)
  ).map((relative) => ({ root: folder, relative }))
}

/**
 * The files a Workspaces task hands over: those its bot named by absolute path inside its worktree or
 * the team folder, those its worktree shows it made, and those its chat and finished children handed over.
 */
function resultFiles(
  deps: BotTeamFinishReportDeps,
  teamId: string,
  own: readonly { text: string }[],
  worktreePath: string | null,
  names: readonly string[],
  handedOver: readonly DeliverableFile[]
): DeliverableFile[] {
  const roots: NamedFileRoot[] = [
    ...(worktreePath === null ? [] : [{ path: worktreePath, skipFolders: NO_SKIPPED_FOLDERS }]),
    { path: deps.folderOf(teamId), skipFolders: TEAM_FOLDER_SKIPPED }
  ]
  const worktreeFiles =
    worktreePath === null ? [] : names.map((relative) => ({ root: worktreePath, relative }))
  const candidates: DeliverableFile[] = [
    ...own.flatMap((message) => namedFilesIn(message.text, roots)),
    ...worktreeFiles,
    ...handedOver
  ]
  const seen = new Set<string>()
  return candidates.filter((file) => {
    const key = `${file.root}\n${file.relative}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/**
 * A Workspaces team gets the task's files attached to the bot's message, as a chat attaches them: copies
 * in the team folder, so the room's Files lists them. A file that cannot be copied is named, not dropped.
 */
function attachResults(
  deps: BotTeamFinishReportDeps,
  team: { id: string; name: string },
  files: readonly DeliverableFile[]
): { attachments: BotTeamRoomAttachment[]; linked: string[] } {
  const split = splitDeliverableFiles(files, BOT_TEAM_ROOM_ATTACHMENT_LIMIT)
  const attachments: BotTeamRoomAttachment[] = []
  const linked = [...split.linked]
  for (const file of split.copy) {
    try {
      attachments.push(
        ...copyBotTeamDeliverables({
          fromFolder: file.root,
          relativePaths: [file.relative],
          fromTeamName: team.name,
          toFolder: deps.folderOf(team.id)
        })
      )
    } catch (error) {
      // Why: one file that cannot be copied must not cost the room its finish line.
      console.warn('[bot-teams] could not copy a finished task file', error)
      linked.push(file.relative)
    }
  }
  return { attachments, linked }
}

/**
 * When a task of the team's own room finishes, makes sure the room hears where the deliverable is:
 * if the bot's own lines already name it, nothing is added. Nothing is posted for a task with no files.
 */
export async function reportFinishedBotTeamTask(
  db: OrchestrationDb,
  sessionId: string,
  deps: BotTeamFinishReportDeps = { folderOf: botTeamFolderPath, settleMs: 3000 }
): Promise<void> {
  const task = db.findBotTeamTaskBySession(sessionId)
  // A task another team asked for reports to the asking room (see `returnFinishedBotTeamTask`).
  if (!task || db.getBotTeamTaskOrigin(task.id)) {
    return
  }
  if (deps.settleMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, deps.settleMs))
  }
  // Why: a child still running means the task is not done; the bot's idle after that child ends reports it.
  if (
    db.listDelegationRequestsByParentStatus(sessionId, OPEN_DELEGATION_STATUSES).some(holdsReport)
  ) {
    return
  }
  const since = task.createdAt ?? Number.POSITIVE_INFINITY
  const language = botTeamReplyLanguage({ text: task.prompt })
  const runAs = handOverRunBy(db, sessionId)
  const { where, names, worktreePath } = await deliverableOf(deps, task.teamId, since, {
    sessionId,
    listed: runAs === null ? null : filesListedBy(db, runAs.taskId)
  })
  const handOvers = handOversMadeBy(db, sessionId)
  const own = db
    .listBotTeamMessages(task.teamId)
    .filter((m) => m.authorBotId === task.ownerBotId && (m.createdAt ?? 0) >= since)
  const team = db.listBotTeams().find((entry) => entry.id === task.teamId)
  if (task.projectId !== null && worktreePath !== null) {
    registerFinishedTaskFiles({
      storeDir: deps.deliverableStoreDir,
      teamId: task.teamId,
      taskId: task.id,
      worktreePath,
      written: names,
      ownLines: own
    })
  }
  const handedOver = [
    ...visualFilesOf(deps, sessionId, since),
    ...childFilesOf(deps, db, sessionId, handOvers)
  ]
  if (team?.workspacesEnabled && (worktreePath !== null || handedOver.length > 0)) {
    const teammates = teammateFilesOf(deps, db, task, handOvers, since, worktreePath)
    const files = resultFiles(deps, task.teamId, own, worktreePath, names, handedOver).filter(
      (file) => !teammates.has(fileKey(file))
    )
    if (files.length > 0) {
      // A later finish of the same task does not attach its files twice.
      if (own.some((m) => (m.attachments?.length ?? 0) > 0)) {
        return
      }
      const { attachments, linked } = attachResults(deps, team, files)
      if (attachments.length > 0) {
        const filesText = botTeamFilesOnlyText(attachments, task.prompt)
        db.postBotTeamMessage({
          teamId: task.teamId,
          authorBotId: task.ownerBotId,
          text: linked.length === 0 ? filesText : `${filesText}\n${linked.join(', ')}`,
          attachments,
          sourceTaskId: task.id
        })
        return
      }
    }
  }
  if (where === null && names.length === 0) {
    return
  }
  const named = (text: string): boolean => {
    const haystack = text.replace(/\\/g, '/')
    return (
      (where !== null && haystack.includes(where.replace(/\\/g, '/'))) ||
      names.some((name) => haystack.includes(name))
    )
  }
  if (own.some((m) => named(m.text))) {
    return
  }
  db.postBotTeamMessage({
    teamId: task.teamId,
    authorBotId: task.ownerBotId,
    text: pickBotTeamLine(DELIVERED, language)(
      task.title,
      where ?? pickBotTeamLine(IN_FOLDER, language),
      names.slice(0, MAX_NAMED).join(', ')
    ),
    sourceTaskId: task.id
  })
}
