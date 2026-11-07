import type { BotTeamRoomAttachment } from '../../shared/bot-team-room-attachments'
import type { BotTeamMessage } from '../../shared/rpc-contract/bot-team-room-params'
import {
  botTeamFilesQuestionLines,
  isBotTeamFilesWithoutWords
} from './bot-team-files-only-question'

/**
 * The files of the person's files-only lines that the room asked about and no words answered yet,
 * oldest first. The walk back stops at the person's latest words, which take those files.
 */
export function botTeamFilesAwaitingInstruction(
  messages: readonly BotTeamMessage[]
): BotTeamRoomAttachment[] {
  const asked = new Set<string>()
  const waiting: BotTeamRoomAttachment[][] = []
  for (const message of messages.toReversed()) {
    if (message.authorBotId !== null) {
      asked.add(message.text)
      continue
    }
    const attachments = message.attachments ?? []
    if (!isBotTeamFilesWithoutWords(message.text, attachments)) {
      break
    }
    const question = botTeamFilesQuestionLines(attachments).find((line) => asked.has(line))
    if (question !== undefined) {
      asked.delete(question)
      waiting.unshift(attachments)
    }
  }
  return waiting.flat()
}

/**
 * The files a request is read with. A line of only files keeps its own; a line with words also
 * takes the files still waiting before it, each file once.
 */
export function botTeamRequestFiles(
  text: string,
  own: readonly BotTeamRoomAttachment[],
  waiting: readonly BotTeamRoomAttachment[]
): BotTeamRoomAttachment[] {
  if (isBotTeamFilesWithoutWords(text, own)) {
    return [...own]
  }
  const byPath = new Map<string, BotTeamRoomAttachment>()
  for (const file of [...waiting, ...own]) {
    byPath.set(file.path, file)
  }
  return [...byPath.values()]
}
