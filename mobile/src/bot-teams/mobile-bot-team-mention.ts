import type { BotTeamMentionName } from '../../../src/shared/bot-team-mention-text'
import type { BotTeam, BotTeamCharacter } from '../../../src/shared/rpc-contract/bot-team-params'

/** A bot or team the room can draw as a chip, with what its icon needs. */
export type MobileBotTeamMentionTarget = BotTeamMentionName & {
  /** The bot's agent; null for a team. */
  agent: string | null
  /** The team's character; null for a bot. */
  character: BotTeamCharacter | null
}

/** The room team's bots and the other teams, the names a room message may mention. */
export function botTeamMentionTargets(
  team: BotTeam,
  teams: readonly BotTeam[]
): MobileBotTeamMentionTarget[] {
  return [
    ...team.bots.map((bot): MobileBotTeamMentionTarget => ({
      name: bot.name,
      kind: 'bot',
      agent: bot.agent,
      character: null
    })),
    ...teams
      .filter((entry) => entry.id !== team.id)
      .map((entry): MobileBotTeamMentionTarget => ({
        name: entry.name,
        kind: 'team',
        agent: null,
        character: entry.character
      }))
  ]
}
