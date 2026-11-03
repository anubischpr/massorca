import { pickBotTeamLine, botTeamReplyLanguage } from '../../shared/bot-team-reply-language'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { copyBotTeamDeliverables, listBotTeamDeliverables } from './bot-team-deliverables'
import { botTeamFolderPath } from './bot-team-version-deps'

export type BotTeamReturnDeps = {
  folderOf: (teamId: string) => string
  /** The bot posts its finish line from its own session, which can land just after the status flips. */
  settleMs: number
}

const DEFAULT_DEPS: BotTeamReturnDeps = { folderOf: botTeamFolderPath, settleMs: 3000 }

const FINISHED = {
  en: (bot: string, title: string) => `${bot} finished "${title}".`,
  es: (bot: string, title: string) => `${bot} terminó "${title}".`
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
      .some((m) => m.authorBotId === task.ownerBotId && (m.createdAt ?? 0) >= since)
  ) {
    return
  }
  const teams = db.listBotTeams()
  const fromTeam = teams.find((team) => team.id === task.teamId)
  const owner = fromTeam?.bots.find((bot) => bot.id === task.ownerBotId)
  if (!fromTeam || !owner) {
    return
  }
  const line = db
    .listBotTeamMessages(task.teamId)
    .findLast((m) => m.authorBotId === owner.id && (m.createdAt ?? 0) >= since)?.text
  const text =
    line?.trim() ||
    pickBotTeamLine(FINISHED, botTeamReplyLanguage({ text: task.prompt }))(owner.name, task.title)
  const fromFolder = deps.folderOf(task.teamId)
  const toTeam = teams.find((team) => team.id === origin.teamId)
  const attachments = toTeam
    ? copyBotTeamDeliverables({
        fromFolder,
        relativePaths: listBotTeamDeliverables(fromFolder, since),
        fromTeamName: fromTeam.name,
        toFolder: deps.folderOf(origin.teamId)
      })
    : []
  db.postBotTeamReturn({
    teamId: origin.teamId,
    fromTeamId: task.teamId,
    fromTaskId: task.id,
    authorBotId: owner.id,
    text,
    attachments
  })
}
