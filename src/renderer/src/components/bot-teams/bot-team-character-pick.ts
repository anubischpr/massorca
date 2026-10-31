import {
  BOT_TEAM_CHARACTERS,
  type BotTeamCharacter
} from '../../../../shared/rpc-contract/bot-team-params'

/** A new team starts on the first character no team uses; with all taken, on the first. */
export function firstUnusedBotTeamCharacter(used: readonly string[]): BotTeamCharacter {
  return BOT_TEAM_CHARACTERS.find((c) => !used.includes(c)) ?? BOT_TEAM_CHARACTERS[0]
}
