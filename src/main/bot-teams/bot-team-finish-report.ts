import { pickBotTeamLine, botTeamReplyLanguage } from '../../shared/bot-team-reply-language'
import {
  BOT_TEAM_ROOM_ATTACHMENT_LIMIT,
  type BotTeamRoomAttachment
} from '../../shared/bot-team-room-attachments'
import { botTeamFilesOnlyText } from '../../shared/bot-team-room-attachments-line'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { copyBotTeamDeliverables, listBotTeamDeliverables } from './bot-team-deliverables'
import { botTeamFolderPath } from './bot-team-version-deps'
import {
  readWorktreeChanges,
  splitWorktreeFiles,
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

/** Where a finished task left its work: its worktree and branch, else the team folder's new files. */
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
  const changes = worktree.local
    ? await (deps.changesOf ?? readWorktreeChanges)(worktree.path)
    : null
  const branch = changes ? `${changes.branch}, ` : ''
  return {
    where: `${branch}${worktree.path}`,
    names: changes?.files ?? [],
    worktreePath: changes ? worktree.path : null
  }
}

/**
 * A Workspaces team gets the task's own changed files attached to the bot's message, as a chat
 * attaches them: copies in the team folder, so the room's Files lists them. Never the whole project.
 */
function attachResults(
  deps: BotTeamFinishReportDeps,
  team: { id: string; name: string },
  worktreePath: string,
  names: readonly string[]
): { attachments: BotTeamRoomAttachment[]; linked: string[] } {
  const { copy, linked } = splitWorktreeFiles(worktreePath, names, BOT_TEAM_ROOM_ATTACHMENT_LIMIT)
  const attachments = copyBotTeamDeliverables({
    fromFolder: worktreePath,
    relativePaths: copy,
    fromTeamName: team.name,
    toFolder: deps.folderOf(team.id)
  })
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
  if (team?.workspacesEnabled && worktreePath !== null && names.length > 0) {
    // A later finish of the same task does not attach its files twice.
    if (own.some((m) => (m.attachments?.length ?? 0) > 0)) {
      return
    }
    const { attachments, linked } = attachResults(deps, team, worktreePath, names)
    if (attachments.length > 0) {
      const files = botTeamFilesOnlyText(attachments, task.prompt)
      db.postBotTeamMessage({
        teamId: task.teamId,
        authorBotId: task.ownerBotId,
        text:
          linked.length === 0
            ? files
            : `${files}
${linked.join(', ')}`,
        attachments
      })
      return
    }
  }
  const named = (text: string): boolean =>
    (where !== null && text.includes(where)) || names.some((name) => text.includes(name))
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
