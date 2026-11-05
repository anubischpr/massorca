import { pickBotTeamLine, botTeamReplyLanguage } from '../../shared/bot-team-reply-language'
import {
  BOT_TEAM_ROOM_ATTACHMENT_FOLDER,
  BOT_TEAM_ROOM_ATTACHMENT_LIMIT,
  type BotTeamRoomAttachment
} from '../../shared/bot-team-room-attachments'
import { botTeamFilesOnlyText } from '../../shared/bot-team-room-attachments-line'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { copyBotTeamDeliverables, listBotTeamDeliverables } from './bot-team-deliverables'
import type { DeliverableFile } from './bot-team-deliverables-copyable'
import { namedFilesIn, type NamedFileRoot } from './bot-team-named-files'
import { botTeamFolderPath } from './bot-team-version-deps'
import { isGitMainCheckout } from './bot-team-workspace-scan'
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
}

const MAX_NAMED = 6

const DELIVERED = {
  en: (title: string, where: string, names: string) =>
    `Deliverable of "${title}": ${where}${names === '' ? '' : ` (${names})`}.`,
  es: (title: string, where: string, names: string) =>
    `Entregable de "${title}": ${where}${names === '' ? '' : ` (${names})`}.`
}

const IN_FOLDER = { en: "the team's Files", es: 'los Archivos del equipo' }

/** A team folder's attachments folder holds the copies a task made, so a copy is never taken from it. */
const TEAM_FOLDER_SKIPPED: ReadonlySet<string> = new Set([BOT_TEAM_ROOM_ATTACHMENT_FOLDER])
/** A worktree's own folders are the bot's work, named as it wrote them. */
const NO_SKIPPED_FOLDERS: ReadonlySet<string> = new Set()

/**
 * Where a finished task left its work: its worktree and branch, else the team folder's new files.
 * A local worktree's names are its git changes plus the files its folder shows were written since the task began.
 */
async function deliverableOf(
  deps: BotTeamFinishReportDeps,
  teamId: string,
  since: number
): Promise<{ where: string | null; names: string[]; worktreePath: string | null }> {
  const worktreeOf = deps.worktreeOf ?? worktreeOfWorkspace
  const worktree = deps.sessionWorkspaceId ? worktreeOf(deps.sessionWorkspaceId) : null
  if (worktree === null) {
    const names = listBotTeamDeliverables(deps.folderOf(teamId), since)
    return { where: null, names, worktreePath: null }
  }
  // Why: an SSH worktree's files live on the host that runs its session; this process cannot read them.
  if (!worktree.local) {
    return { where: worktree.path, names: [], worktreePath: null }
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

/**
 * The files a Workspaces task hands over: those its bot named by absolute path inside its worktree or
 * the team folder, then those its worktree shows it made. Nothing outside those two folders.
 */
function resultFiles(
  deps: BotTeamFinishReportDeps,
  teamId: string,
  own: readonly { text: string }[],
  worktreePath: string,
  names: readonly string[]
): DeliverableFile[] {
  const roots: NamedFileRoot[] = [
    { path: worktreePath, skipFolders: NO_SKIPPED_FOLDERS },
    { path: deps.folderOf(teamId), skipFolders: TEAM_FOLDER_SKIPPED }
  ]
  const candidates: DeliverableFile[] = [
    ...own.flatMap((message) => namedFilesIn(message.text, roots)),
    ...names.map((relative) => ({ root: worktreePath, relative }))
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
  const since = task.createdAt ?? Number.POSITIVE_INFINITY
  const language = botTeamReplyLanguage({ text: task.prompt })
  const { where, names, worktreePath } = await deliverableOf(deps, task.teamId, since)
  if (where === null && names.length === 0) {
    return
  }
  const own = db
    .listBotTeamMessages(task.teamId)
    .filter((m) => m.authorBotId === task.ownerBotId && (m.createdAt ?? 0) >= since)
  const team = db.listBotTeams().find((entry) => entry.id === task.teamId)
  if (team?.workspacesEnabled && worktreePath !== null) {
    const files = resultFiles(deps, task.teamId, own, worktreePath, names)
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
          attachments
        })
        return
      }
    }
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
    )
  })
}
