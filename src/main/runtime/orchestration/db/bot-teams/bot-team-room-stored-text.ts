import type {
  BotTeamMessage,
  BotTeamMessageInput
} from '../../../../../shared/rpc-contract/bot-team-room-params'
import {
  encodeBotTeamRoomAttachments,
  splitBotTeamRoomAttachments
} from '../../../../../shared/bot-team-room-attachments'
import {
  encodeBotTeamRoomReply,
  splitBotTeamRoomReply
} from '../../../../../shared/bot-team-room-reply-marker'

/** The text a room line is stored as: what was written, then the message it answers, then its files. */
export function botTeamRoomStoredText(input: BotTeamMessageInput): string {
  return encodeBotTeamRoomAttachments(
    encodeBotTeamRoomReply(input.text, input.replyToMessageId),
    input.attachments ?? []
  )
}

/** The visible text, with the files and the answered message a line stores after it; a message with none is unchanged. */
export function botTeamRoomMessageFromStored(message: BotTeamMessage): BotTeamMessage {
  const split = splitBotTeamRoomAttachments(message.text)
  const reply = splitBotTeamRoomReply(split.text)
  return {
    ...message,
    text: reply.text,
    ...(split.attachments.length > 0 ? { attachments: split.attachments } : {}),
    ...(reply.replyToMessageId !== null ? { replyToMessageId: reply.replyToMessageId } : {})
  }
}
