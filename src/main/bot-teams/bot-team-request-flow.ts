import { chooseBotTeamOwner, findMentionedBot } from '../../shared/bot-team-owner-selection'
import {
  buildBotTeamClassifyPrompt,
  parseBotTeamClassifyReply
} from '../../shared/bot-team-request-classify'
import type { BotTeamRequestChoice } from '../../shared/bot-team-request-choice'
import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'

export type BotTeamRequestDecision =
  /** `alsoNeeds` holds the other bots a composite task has parts for. */
  | { type: 'task'; bot: BotTeamBot; alsoNeeds: string[] }
  | { type: 'choice'; choice: BotTeamRequestChoice }
  /** The person named another team with @: it goes there, with no query. */
  | { type: 'team'; teamId: string }
  | { type: 'conversation' }
  /** Nothing could decide: the room asks the person who should take it. */
  | { type: 'ask' }

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

/** Who takes a request. A mention skips the query; no bot is ever a configured lead. */
export async function decideBotTeamRequest(args: {
  text: string
  team: BotTeam
  otherTeams: readonly BotTeam[]
  activeTasksByBot: Readonly<Record<string, number>>
  classify: (prompt: string) => Promise<string | null>
}): Promise<BotTeamRequestDecision> {
  const { team, text } = args
  const mentioned = findMentionedBot(text, team.bots)
  if (mentioned) {
    return { type: 'task', bot: mentioned, alsoNeeds: [] }
  }
  const mentionedTeam = findMentionedBot(text, args.otherTeams)
  if (mentionedTeam) {
    return { type: 'team', teamId: mentionedTeam.id }
  }
  if (team.bots.length === 0) {
    return { type: 'ask' }
  }
  const reply = await askOrNull(
    args.classify,
    buildBotTeamClassifyPrompt(team, team.bots, args.otherTeams, text)
  )
  const result =
    reply === null
      ? null
      : parseBotTeamClassifyReply(reply, { bots: team.bots, teams: args.otherTeams })
  if (result === null) {
    // A team of one has only one answer, as before the query existed.
    return team.bots.length === 1
      ? { type: 'task', bot: team.bots[0], alsoNeeds: [] }
      : { type: 'ask' }
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
        return { type: 'ask' }
      }
      const alsoNeeds =
        result.kind === 'composite' ? result.botIds.filter((id) => id !== owner.id) : []
      return { type: 'task', bot: owner, alsoNeeds }
    }
    case 'team-scope':
      return { type: 'choice', choice: { kind: 'new-bot' } }
    case 'other-team':
      return { type: 'choice', choice: { kind: 'other-team', teamId: result.teamId } }
    case 'no-team':
      return { type: 'choice', choice: { kind: 'new-team' } }
    case 'conversation':
      return { type: 'conversation' }
  }
}
