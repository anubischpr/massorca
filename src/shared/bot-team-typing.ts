import { isBotTeamGreeting } from './bot-team-greeting'
import { findMentionedBot } from './bot-team-owner-selection'
import type { BotTeamTask } from './rpc-contract/bot-team-room-params'

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

/** How often a client re-reads the room while the host reports a reply in flight. */
export const BOT_TEAM_REPLYING_POLL_MS = 1_500

/** Who the room shows as typing for a reply the host still has in flight; null when none is. */
export function botTeamReplyingAuthor<TBot extends { id: string }>(
  replying: readonly { botId: string; since?: number }[] | undefined,
  bots: readonly TBot[]
): BotTeamTypingAuthor<TBot> | null {
  const first = replying?.[0]
  if (first === undefined) {
    return null
  }
  const bot = bots.find((candidate) => candidate.id === first.botId)
  return bot ? { kind: 'bot', bot } : { kind: 'team' }
}

export type BotTeamAnsweringTask = Pick<
  BotTeamTask,
  'ownerBotId' | 'sessionId' | 'lastStatus' | 'awaitingPerson' | 'answersMessageId' | 'createdAt'
>

/**
 * The bots a reply task still works for. The room shows each one typing in place of the task's card,
 * until the task ends or waits for the person.
 */
export function botTeamAnsweringReplying(
  tasks: readonly BotTeamAnsweringTask[]
): { botId: string; since: number }[] {
  return tasks
    .filter(
      (task) =>
        task.answersMessageId !== undefined &&
        task.sessionId !== null &&
        !task.lastStatus &&
        !task.awaitingPerson
    )
    .map((task) => ({ botId: task.ownerBotId, since: task.createdAt ?? 0 }))
}

/** One id per send; a client reuses it when it retries that same send, so the host posts it once. */
export function newBotTeamClientRequestId(): string {
  const random = Math.random().toString(36).slice(2, 12)
  return `${Date.now().toString(36)}-${random}`
}
