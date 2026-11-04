import { pickBotTeamLine, botTeamReplyLanguage } from '../../shared/bot-team-reply-language'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { listBotTeamDeliverables } from './bot-team-deliverables'
import { botTeamFolderPath } from './bot-team-version-deps'
import { readWorktreeChanges, worktreeOfWorkspace } from './bot-team-worktree-deliverables'

export type BotTeamFinishReportDeps = {
  folderOf: (teamId: string) => string
  /** The bot posts its finish line from its own session, which can land just after the status flips. */
  settleMs: number
  sessionWorkspaceId?: string | null
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
): Promise<{ where: string | null; names: string[] }> {
  const worktree = deps.sessionWorkspaceId ? worktreeOfWorkspace(deps.sessionWorkspaceId) : null
  if (worktree === null) {
    return { where: null, names: listBotTeamDeliverables(deps.folderOf(teamId), since) }
  }
  const changes = worktree.local ? await readWorktreeChanges(worktree.path) : null
  const branch = changes ? `${changes.branch}, ` : ''
  return { where: `${branch}${worktree.path}`, names: changes?.files ?? [] }
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
  const { where, names } = await deliverableOf(deps, task.teamId, since)
  if (where === null && names.length === 0) {
    return
  }
  const own = db
    .listBotTeamMessages(task.teamId)
    .filter((m) => m.authorBotId === task.ownerBotId && (m.createdAt ?? 0) >= since)
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
