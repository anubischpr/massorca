import { chooseBotTeamOwner, findMentionedBot } from '../../shared/bot-team-owner-selection'
import {
  botTeamReplyLanguage,
  pickBotTeamLine,
  type BotTeamLines,
  type BotTeamReplyLanguage
} from '../../shared/bot-team-reply-language'
import { botTeamFileNamesText } from '../../shared/bot-team-room-attachments-line'
import type { BotTeamRoomAttachment } from '../../shared/bot-team-room-attachments'
import type { BotTeam, BotTeamBot } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamMessage } from '../../shared/rpc-contract/bot-team-room-params'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { isBotTeamSaveOnlyText } from '../../shared/bot-team-files-save-only'
import { botTeamFilesAskedBy } from './bot-team-files-only-carry'

/**
 * The bot that asks about files sent with no words: the one the person names, else the one they reply
 * to, else the least busy bot of the team. The save-only answer uses the same bot.
 */
export function botTeamFilesAsker(args: {
  text: string
  bots: readonly BotTeamBot[]
  quotedBot?: BotTeamBot | null
  activeTasksByBot: Readonly<Record<string, number>>
}): BotTeamBot | null {
  return (
    findMentionedBot(args.text, args.bots) ??
    args.quotedBot ??
    chooseBotTeamOwner({
      matchedBotIds: args.bots.map((bot) => bot.id),
      bots: args.bots,
      activeTasksByBot: args.activeTasksByBot
    })
  )
}

/**
 * Whether a line keeps the files it comes with: save words only, and no other team named, since a named
 * team means the files go there.
 */
export function isBotTeamFilesSaveAnswer(args: {
  text: string
  files: readonly BotTeamRoomAttachment[]
  otherTeams: readonly BotTeam[]
}): boolean {
  return (
    args.files.length > 0 &&
    isBotTeamSaveOnlyText(args.text) &&
    findMentionedBot(args.text, args.otherTeams) === null
  )
}

const SAVED_LINES: BotTeamLines<(names: string, count: number) => string> = {
  en: (names) => `Saved: ${names}.`,
  es: (names, count) => `${count === 1 ? 'Guardado' : 'Guardados'}: ${names}.`
}

/** The short line the bot posts once it has kept the files, in the person's language. */
export function botTeamFilesSavedLine(
  files: readonly BotTeamRoomAttachment[],
  language: BotTeamReplyLanguage
): string {
  return pickBotTeamLine(SAVED_LINES, language)(botTeamFileNamesText(files), files.length)
}

/**
 * Keeps the files of a save-only line: the bot that asked about them says so. Nothing is filed; the
 * files stay in the team folder, which the room's Files lists.
 */
export function postBotTeamFilesSaved(
  db: OrchestrationDb,
  args: {
    team: BotTeam
    text: string
    earlier: readonly BotTeamMessage[]
    earlierText: string
    files: readonly BotTeamRoomAttachment[]
    quotedBot: BotTeamBot | null
    activeTasksByBot: Readonly<Record<string, number>>
  }
): void {
  const askedBy = botTeamFilesAskedBy(args.earlier)
  const keeper =
    args.team.bots.find((bot) => bot.id === askedBy) ??
    botTeamFilesAsker({
      text: args.text,
      bots: args.team.bots,
      quotedBot: args.quotedBot,
      activeTasksByBot: args.activeTasksByBot
    })
  if (keeper === null) {
    return
  }
  const language = botTeamReplyLanguage({ text: `${args.text} ${args.earlierText}` })
  db.postBotTeamMessage({
    teamId: args.team.id,
    authorBotId: keeper.id,
    text: botTeamFilesSavedLine(args.files, language)
  })
}
