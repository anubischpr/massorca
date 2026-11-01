import { findMentionedBot } from './bot-team-lead-selection'

type NamedBot = { id: string; name: string }

const TITLE_MAX_CHARS = 80

/** Who takes a request without a query: a mentioned bot, or a team's only bot. Null asks the person. */
export function routeBotTeamRequest<TBot extends NamedBot>(
  text: string,
  bots: readonly TBot[]
): TBot | null {
  return findMentionedBot(text, bots) ?? (bots.length === 1 ? bots[0] : null)
}

export function botTeamTaskTitle(text: string, bots: readonly NamedBot[]): string {
  const firstLine = text.trim().split(/\r?\n/, 1)[0]
  const mentioned = findMentionedBot(firstLine, bots)
  const withoutMention = mentioned
    ? firstLine.replace(new RegExp(`@${escapeRegExp(mentioned.name)}`, 'i'), '').trim()
    : firstLine
  const title = withoutMention || firstLine
  return title.length > TITLE_MAX_CHARS ? `${title.slice(0, TITLE_MAX_CHARS - 1)}…` : title
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
