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
