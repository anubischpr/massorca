import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import type { BotTeamReplyQuote } from './bot-team-prompt-notes'

export type BotTeamReplyTarget = {
  quote: BotTeamReplyQuote
  /** The bot that wrote the quoted line; null for the person's own line. */
  bot: BotTeamBot | null
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
  if (message.authorBotId === null) {
    return { quote: { authorName: null, text: message.text }, bot: null }
  }
  const bot = team.bots.find((entry) => entry.id === message.authorBotId)
  return bot ? { quote: { authorName: bot.name, text: message.text }, bot } : null
}
