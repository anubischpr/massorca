import {
  BOT_TEAM_ALL_AUTHOR,
  botTeamGreetingLine,
  isBotTeamGreeting
} from '../../shared/bot-team-greeting'
import type { BotTeamMessage } from '../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'

/** A bare greeting gets one rotating line from All: no agent runs, no task is made. */
export function replyToBotTeamGreeting(
  db: OrchestrationDb,
  args: { teamId: string; text: string; random?: () => number }
): BotTeamMessage | null {
  // An @mention names a bot, so it is a request even when it is short.
  if (args.text.includes('@') || !isBotTeamGreeting(args.text)) {
    return null
  }
  const previous = db
    .listBotTeamMessages(args.teamId)
    .findLast((message) => message.authorBotId === BOT_TEAM_ALL_AUTHOR)?.text
  return db.postBotTeamMessage({
    teamId: args.teamId,
    authorBotId: BOT_TEAM_ALL_AUTHOR,
    text: botTeamGreetingLine({ text: args.text, previous, random: args.random })
  })
}
