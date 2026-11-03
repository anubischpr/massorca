import { botTeamReplyLanguage, pickBotTeamLine } from './bot-team-reply-language'
import type { BotTeamRoomAttachment } from './bot-team-room-attachments'

const LINES = {
  en: (names: string) => `Files attached: ${names}`,
  es: (names: string) => `Archivos adjuntos: ${names}`
}

/** The line a message of only files is filed with, in the language of what the person wrote before. */
export function botTeamFilesOnlyText(
  attachments: readonly BotTeamRoomAttachment[],
  earlierText: string
): string {
  const names = attachments.map((attachment) => attachment.name).join(', ')
  return pickBotTeamLine(LINES, botTeamReplyLanguage({ text: earlierText }))(names)
}

/** The least text an older host accepts for a message of only files: the file names. */
export function botTeamFileNamesText(attachments: readonly BotTeamRoomAttachment[]): string {
  return attachments.map((attachment) => attachment.name).join(', ')
}

/** True for the text a message of only files was filed with, which the room shows as its chips alone. */
export function isBotTeamFilesOnlyText(
  text: string,
  attachments: readonly BotTeamRoomAttachment[] | undefined
): boolean {
  if (!attachments || attachments.length === 0) {
    return false
  }
  const names = botTeamFileNamesText(attachments)
  const typed = text.trim()
  return typed === names || Object.values(LINES).some((line) => line(names) === typed)
}
