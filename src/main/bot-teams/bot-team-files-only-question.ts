import type { BotTeamRoomAttachment } from '../../shared/bot-team-room-attachments'
import {
  botTeamFileNamesText,
  isBotTeamFilesOnlyText
} from '../../shared/bot-team-room-attachments-line'
import { botTeamReplyLanguage, pickBotTeamLine } from '../../shared/bot-team-reply-language'

// The names are in the line, so each set of files asks its own question and the room keeps both.
const QUESTION = {
  en: (names: string) => `What do you want me to do with ${names}?`,
  es: (names: string) => `¿Qué quieres que haga con ${names}?`
}

const MENTIONS_ONLY = /^@\S+(?:\s+@\S+)*$/u

/**
 * Files that came with no words of their own: no typed text, only the line that names the files,
 * or only the `@Name` of the bot or team they go to. Such a line is asked about, never filed.
 */
export function isBotTeamFilesWithoutWords(
  text: string,
  attachments: readonly BotTeamRoomAttachment[]
): boolean {
  if (attachments.length === 0) {
    return false
  }
  const typed = text.trim()
  return typed === '' || isBotTeamFilesOnlyText(typed, attachments) || MENTIONS_ONLY.test(typed)
}

/** The question a bot asks about files with no words, in the language the person wrote before. */
export function botTeamFilesQuestion(
  attachments: readonly BotTeamRoomAttachment[],
  earlierText: string
): string {
  const names = botTeamFileNamesText(attachments)
  return pickBotTeamLine(QUESTION, botTeamReplyLanguage({ text: earlierText }))(names)
}

/** The question in each language for these files, so a walk over the room can find the one asked. */
export function botTeamFilesQuestionLines(attachments: readonly BotTeamRoomAttachment[]): string[] {
  const names = botTeamFileNamesText(attachments)
  return [QUESTION.en(names), QUESTION.es(names)]
}
