import { isBotTeamGreeting } from './bot-team-greeting'
import { findMentionedBot } from './bot-team-owner-selection'

export type BotTeamTypingAuthor<TBot> =
  | { kind: 'all' }
  | { kind: 'bot'; bot: TBot }
  | { kind: 'team' }

/** Who the room shows as typing while a message is with the host; 'team' until the host picks a bot. */
export function botTeamTypingAuthor<TBot extends { id: string; name: string }>(
  text: string,
  bots: readonly TBot[]
): BotTeamTypingAuthor<TBot> {
  if (isBotTeamGreeting(text)) {
    return { kind: 'all' }
  }
  const bot = findMentionedBot(text, bots)
  return bot ? { kind: 'bot', bot } : { kind: 'team' }
}
