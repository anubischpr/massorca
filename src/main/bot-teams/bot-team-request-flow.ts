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
import {
  botTeamClassifyScheduledMoment,
  botTeamRequestScheduledMoment,
  type BotTeamScheduledMoment
} from '../../shared/bot-team-request-schedule'
import { botTeamClockLine } from '../../shared/bot-team-person-clock'
import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'

/** `later` is set only when the person wants the work later, so an unset decision means now. */
type Later = { later?: true }

export type BotTeamRequestDecision =
  /**
   * `alsoNeeds` holds the other bots a composite task has parts for. `scheduledFor`: the day and time
   * the person named for a one-bot task, which then runs once at that moment instead of being filed.
   */
  | ({
      type: 'task'
      bot: BotTeamBot
      alsoNeeds: string[]
      scheduledFor?: BotTeamScheduledMoment
    } & Later)
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

type DecideArgs = {
  text: string
  team: BotTeam
  otherTeams: readonly BotTeam[]
  activeTasksByBot: Readonly<Record<string, number>>
  classify: (prompt: string) => Promise<string | null>
  /** The host's clock, for reading a named day; now by default. */
  now?: number
  /** The asking person's zone: a named day and time are read on their clock. */
  timeZone?: string | null
  /** The bot whose room message this request replies to; it takes the request unless a bot or team is named. */
  quotedBot?: BotTeamBot | null
}

/**
 * Who takes a request, and when: a one-bot task whose day the query read, or the words name, is
 * scheduled for that moment. A mention skips the query; no bot is ever a configured lead.
 */
export async function decideBotTeamRequest(args: DecideArgs): Promise<BotTeamRequestDecision> {
  const now = args.now ?? Date.now()
  let reply: string | null = null
  const decision = await decideOwner({
    ...args,
    now,
    classify: async (prompt) => {
      reply = await args.classify(prompt)
      return reply
    }
  })
  if (decision.type !== 'task' || decision.alsoNeeds.length > 0) {
    return decision
  }
  const moment =
    (reply === null ? null : botTeamClassifyScheduledMoment(reply, now, args.timeZone ?? null)) ??
    botTeamRequestScheduledMoment(args.text, now, args.timeZone ?? null)
  return moment === null ? decision : { ...decision, scheduledFor: moment, later: true }
}

async function decideOwner(args: DecideArgs & { now: number }): Promise<BotTeamRequestDecision> {
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
  // A reply goes to the bot it quotes, which hands on what is far from its job.
  if (args.quotedBot) {
    return { type: 'task', bot: args.quotedBot, alsoNeeds: [], ...laterOf(timing.later) }
  }
  if (team.bots.length === 0) {
    return { type: 'ask' }
  }
  const reply = await askOrNull(
    args.classify,
    buildBotTeamClassifyPrompt(
      team,
      team.bots,
      args.otherTeams,
      text,
      botTeamClockLine(args.now, args.timeZone ?? null)
    )
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
