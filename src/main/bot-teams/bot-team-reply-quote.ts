import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import type { BotTeamQuotedTask, BotTeamReplyQuote } from './bot-team-prompt-notes'

export type BotTeamReplyTarget = {
  quote: BotTeamReplyQuote
  /** The bot that wrote the quoted line; null for the person's own line. */
  bot: BotTeamBot | null
}

/** The task that posted a quoted line, read from the same team; null when no task of it is left. */
function quotedTaskOf(
  db: OrchestrationDb,
  team: BotTeam,
  taskId: string
): BotTeamQuotedTask | null {
  const task = db.listBotTeamTasks(team.id).find((entry) => entry.id === taskId)
  return task ? { title: task.title, prompt: task.prompt, projectId: task.projectId } : null
}

/**
 * The room message a reply answers, read from the same team. A line from another team, or a line no
 * team bot wrote and the person did not write either, quotes nothing.
 */
export function botTeamReplyTarget(
  db: OrchestrationDb,
  team: BotTeam,
  messageId: string
): BotTeamReplyTarget | null {
  const message = db.listBotTeamMessages(team.id).find((entry) => entry.id === messageId)
  if (!message || message.fromTeamId !== undefined || message.text.trim() === '') {
    return null
  }
  const sourceTask =
    message.sourceTaskId === undefined ? null : quotedTaskOf(db, team, message.sourceTaskId)
  const line = {
    text: message.text,
    messageId: message.id,
    ...(sourceTask ? { sourceTask } : {})
  }
  if (message.authorBotId === null) {
    return { quote: { authorName: null, ...line }, bot: null }
  }
  const bot = team.bots.find((entry) => entry.id === message.authorBotId)
  return bot ? { quote: { authorName: bot.name, ...line }, bot } : null
}
