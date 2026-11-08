import path from 'node:path'
import { z } from 'zod'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { BOT_TEAM_ROOM_ATTACHMENT_FOLDER } from '../../shared/bot-team-room-attachments'
import { PROTOTYPE_FOLDER } from '../../shared/prototype-request-folder'
import { isBotTeamFileVisible } from '../../shared/rpc-contract/bot-team-files-visibility'
import type { DeliverableFile } from './bot-team-deliverables-copyable'
import type { BotTeamFinishReportDeps } from './bot-team-finish-report'
import type { BotTeamHandOver } from './bot-team-finish-handovers'
import { namedFilesAmong, namedFilesIn, type NamedFileRoot } from './bot-team-named-files'
import { worktreeOfWorkspace } from './bot-team-worktree-deliverables'

/** A team folder's attachments folder holds the copies a task made, so a copy is never taken from it. */
export const TEAM_FOLDER_SKIPPED: ReadonlySet<string> = new Set([BOT_TEAM_ROOM_ATTACHMENT_FOLDER])
/** A worktree's own folders are the bot's work, named as it wrote them. */
export const NO_SKIPPED_FOLDERS: ReadonlySet<string> = new Set()
/** A prototype shows as its own link in the room, so its request folder hands over no file. */
const VISUALS_SKIPPED: ReadonlySet<string> = new Set([PROTOTYPE_FOLDER])

/** A task's result when its worker reported: the files it changed. Any other result lists none. */
const WORKER_REPORT_FILES = z.object({ filesModified: z.array(z.string()) })

/** The files each finished child of a session listed in its task's result, read where that child works. */
export function childFilesOf(
  deps: BotTeamFinishReportDeps,
  db: OrchestrationDb,
  sessionId: string,
  handOvers: readonly BotTeamHandOver[]
): DeliverableFile[] {
  const teammates = new Set(handOvers.map((handOver) => handOver.requestId))
  return db
    .listDelegationRequestsByParentStatus(sessionId, ['finished'])
    .filter((request) => !teammates.has(request.id))
    .flatMap((request) => filesOfChild(deps, db, request.child_session_id, request.task_id))
}

/** The files a finished child listed in its task's result, read where that child works. */
function filesOfChild(
  deps: BotTeamFinishReportDeps,
  db: OrchestrationDb,
  childSessionId: string | null,
  taskId: string | null
): DeliverableFile[] {
  if (childSessionId === null) {
    return []
  }
  const { worktree, roots } = childRootsOf(deps, childSessionId)
  const listed = filesListedBy(db, taskId).map((file) =>
    worktree === null || path.isAbsolute(file) ? file : path.join(worktree, file)
  )
  // Why: the design system a prototype writes is the agent's working material, not a deliverable.
  return namedFilesAmong(listed, roots).filter((file) => isBotTeamFileVisible(file.relative))
}

/**
 * The files teammates the session handed work to delivered: those their reports list and those their room
 * lines name. The lead never re-attaches them; each teammate's own finish line carries them.
 */
export function teammateFilesOf(
  deps: BotTeamFinishReportDeps,
  db: OrchestrationDb,
  task: { teamId: string },
  handOvers: readonly BotTeamHandOver[],
  since: number,
  worktreePath: string | null
): ReadonlySet<string> {
  const roots: NamedFileRoot[] = [
    ...(worktreePath === null ? [] : [{ path: worktreePath, skipFolders: NO_SKIPPED_FOLDERS }]),
    { path: deps.folderOf(task.teamId), skipFolders: TEAM_FOLDER_SKIPPED }
  ]
  const owners = new Set(handOvers.map((handOver) => handOver.ownerBotId))
  const named = db
    .listBotTeamMessages(task.teamId)
    .filter(
      (m) => m.authorBotId !== null && owners.has(m.authorBotId) && (m.createdAt ?? 0) >= since
    )
    .flatMap((m) => namedFilesIn(m.text, roots))
  const listed = handOvers.flatMap((handOver) =>
    filesOfChild(deps, db, handOver.childSessionId, handOver.taskId)
  )
  return new Set([...named, ...listed].map(fileKey))
}

export function fileKey(file: DeliverableFile): string {
  return path.resolve(file.root, file.relative)
}

/** Where a finished child's files may sit: its worktree, and its own chat-visuals folder for a prototype. */
function childRootsOf(
  deps: BotTeamFinishReportDeps,
  childSessionId: string
): { worktree: string | null; roots: NamedFileRoot[] } {
  const workspaceId = deps.workspaceOfSession?.(childSessionId) ?? null
  const location =
    workspaceId === null ? null : (deps.worktreeOf ?? worktreeOfWorkspace)(workspaceId)
  const worktree = location?.local ? location.path : null
  const visuals = deps.visualsFolderOf?.(childSessionId)
  return {
    worktree,
    roots: [
      ...(worktree === null ? [] : [{ path: worktree, skipFolders: NO_SKIPPED_FOLDERS }]),
      ...(visuals === undefined ? [] : [{ path: visuals, skipFolders: VISUALS_SKIPPED }])
    ]
  }
}

/** The files a task's worker listed as changed; a result that is not a worker report lists none. */
export function filesListedBy(db: OrchestrationDb, taskId: string | null): string[] {
  const result = taskId === null ? null : (db.getTask(taskId)?.result ?? null)
  if (result === null) {
    return []
  }
  try {
    const parsed = WORKER_REPORT_FILES.safeParse(JSON.parse(result))
    return parsed.success ? parsed.data.filesModified : []
  } catch {
    // Why: a result that is plain text, not a worker report, lists no files.
    return []
  }
}
