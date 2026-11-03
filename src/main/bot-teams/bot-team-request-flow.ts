import {
  chooseBotTeamOwner,
  findMentionedBot,
  rankBotsForRequest
} from '../../shared/bot-team-owner-selection'
import {
  buildBotTeamClassifyPrompt,
  parseBotTeamClassifyLater,
  parseBotTeamClassifyReply
} from '../../shared/bot-team-request-classify'
import {
  asksForUniversalBotCapability,
  isBotTeamActionRequest
} from '../../shared/bot-team-request-action'
import type { BotTeamRequestChoice } from '../../shared/bot-team-request-choice'
import { botTeamRequestTiming } from '../../shared/bot-team-request-later'
import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'

/** `later` is set only when the person wants the work later, so an unset decision means now. */
type Later = { later?: true }

export type BotTeamRequestDecision =
  /** `alsoNeeds` holds the other bots a composite task has parts for. */
  | ({ type: 'task'; bot: BotTeamBot; alsoNeeds: string[] } & Later)
  | ({ type: 'choice'; choice: BotTeamRequestChoice } & Later)
  /** The person named another team with @: it goes there, with no query. */
  | ({ type: 'team'; teamId: string } & Later)
  /** `subjectBotIds`: the bots whose description fits what was said, best first. */
  | ({ type: 'conversation'; subjectBotIds: string[] } & Later)
  /** The team has no bot to take anything. */
  | { type: 'ask' }

function laterOf(later: boolean): Later {
  return later ? { later: true } : {}
}

async function askOrNull(
  classify: (prompt: string) => Promise<string | null>,
  prompt: string
): Promise<string | null> {
  try {
    return await classify(prompt)
  } catch {
    return null
  }
}

/** The one bot whose name and job share the most words with the request, when it is the only one. */
function clearBotFor(text: string, bots: readonly BotTeamBot[]): BotTeamBot | null {
  const [first, second] = rankBotsForRequest(text, bots)
  if (first === undefined || first.score === 0) {
    return null
  }
  return second === undefined || second.score < first.score ? first.bot : null
}

/**
 * The bot that takes an order the query read as chat or as outside the team. Option cards and
 * artifacts are every bot's, so the least busy one takes them; other work needs a clear subject match.
 */
function actionOwner(
  text: string,
  team: BotTeam,
  activeTasksByBot: Readonly<Record<string, number>>,
  namedBotIds: readonly string[]
): BotTeamBot | null {
  if (!isBotTeamActionRequest(text)) {
    return null
  }
  const matched = namedBotIds.length > 0 ? namedBotIds : team.bots.map((bot) => bot.id)
  if (namedBotIds.length === 0 && !asksForUniversalBotCapability(text)) {
    return clearBotFor(text, team.bots)
  }
  return chooseBotTeamOwner({ matchedBotIds: matched, bots: team.bots, activeTasksByBot })
}

/** The bot a new-bot question picks first: the one the query named, else the best word match. */
function suggestedBot(
  text: string,
  bots: readonly BotTeamBot[],
  namedBotIds: readonly string[]
): { suggestedBotId?: string } {
  const named = namedBotIds[0]
  if (named !== undefined) {
    return { suggestedBotId: named }
  }
  const [first] = rankBotsForRequest(text, bots)
  return first !== undefined && first.score > 0 ? { suggestedBotId: first.bot.id } : {}
}

/** Who takes a request. A mention skips the query; no bot is ever a configured lead. */
export async function decideBotTeamRequest(args: {
  text: string
  team: BotTeam
  otherTeams: readonly BotTeam[]
  activeTasksByBot: Readonly<Record<string, number>>
  classify: (prompt: string) => Promise<string | null>
}): Promise<BotTeamRequestDecision> {
  const { team, text } = args
  const timing = botTeamRequestTiming(text)
  const mentioned = findMentionedBot(text, team.bots)
  if (mentioned) {
    return { type: 'task', bot: mentioned, alsoNeeds: [], ...laterOf(timing.later) }
  }
  const mentionedTeam = findMentionedBot(text, args.otherTeams)
  if (mentionedTeam) {
    return { type: 'team', teamId: mentionedTeam.id, ...laterOf(timing.later) }
  }
  if (team.bots.length === 0) {
    return { type: 'ask' }
  }
  const reply = await askOrNull(
    args.classify,
    buildBotTeamClassifyPrompt(team, team.bots, args.otherTeams, text)
  )
  const later = timing.later || (reply !== null && parseBotTeamClassifyLater(reply))
  const result =
    reply === null
      ? null
      : parseBotTeamClassifyReply(reply, { bots: team.bots, teams: args.otherTeams })
  if (result === null) {
    const ordered = actionOwner(text, team, args.activeTasksByBot, [])
    if (ordered) {
      return { type: 'task', bot: ordered, alsoNeeds: [], ...laterOf(later) }
    }
    // A team of one has only one answer, as before the query existed.
    if (team.bots.length === 1) {
      return { type: 'task', bot: team.bots[0], alsoNeeds: [], ...laterOf(later) }
    }
    return {
      type: 'choice',
      choice: { kind: 'new-bot', ...suggestedBot(text, team.bots, []) },
      ...laterOf(later)
    }
  }
  switch (result.kind) {
    case 'bot':
    case 'composite': {
      const owner = chooseBotTeamOwner({
        matchedBotIds: result.botIds,
        bots: team.bots,
        activeTasksByBot: args.activeTasksByBot
      })
      if (!owner) {
        return {
          type: 'choice',
          choice: { kind: 'new-bot', ...suggestedBot(text, team.bots, []) },
          ...laterOf(later)
        }
      }
      const alsoNeeds =
        result.kind === 'composite' ? result.botIds.filter((id) => id !== owner.id) : []
      return { type: 'task', bot: owner, alsoNeeds, ...laterOf(later) }
    }
    // The query can say no bot covers a subject that one bot's job names: that bot then takes it.
    case 'team-scope': {
      const clear = clearBotFor(text, team.bots)
      if (clear) {
        return { type: 'task', bot: clear, alsoNeeds: [], ...laterOf(later) }
      }
      return {
        type: 'choice',
        choice: { kind: 'new-bot', ...suggestedBot(text, team.bots, result.botIds) },
        ...laterOf(later)
      }
    }
    case 'no-team': {
      // Option cards and artifacts belong to every bot, so "outside the team" cannot apply to them.
      const ordered = asksForUniversalBotCapability(text)
        ? actionOwner(text, team, args.activeTasksByBot, [])
        : null
      if (ordered) {
        return { type: 'task', bot: ordered, alsoNeeds: [], ...laterOf(later) }
      }
      const clear = clearBotFor(text, team.bots)
      if (clear) {
        return { type: 'task', bot: clear, alsoNeeds: [], ...laterOf(later) }
      }
      return { type: 'choice', choice: { kind: 'new-team' }, ...laterOf(later) }
    }
    case 'other-team':
      return {
        type: 'choice',
        choice: { kind: 'other-team', teamId: result.teamId },
        ...laterOf(later)
      }
    case 'conversation': {
      // An order to make something is work, however the query read it: it never gets a chat answer.
      const ordered = actionOwner(text, team, args.activeTasksByBot, result.botIds)
      if (ordered) {
        return { type: 'task', bot: ordered, alsoNeeds: [], ...laterOf(later) }
      }
      if (isBotTeamActionRequest(text)) {
        return {
          type: 'choice',
          choice: { kind: 'new-bot', ...suggestedBot(text, team.bots, result.botIds) },
          ...laterOf(later)
        }
      }
      return { type: 'conversation', subjectBotIds: result.botIds, ...laterOf(later) }
    }
  }
}
