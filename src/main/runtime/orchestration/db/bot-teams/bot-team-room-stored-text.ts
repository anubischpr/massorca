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
import {
  encodeBotTeamRoomSourceTask,
  splitBotTeamRoomSourceTask
} from '../../../../../shared/bot-team-room-source-task-marker'

/** The text a room line is stored as: what was written, then the message it answers, then the task that posted it, then its files. */
export function botTeamRoomStoredText(input: BotTeamMessageInput): string {
  return encodeBotTeamRoomAttachments(
    encodeBotTeamRoomSourceTask(
      encodeBotTeamRoomReply(input.text, input.replyToMessageId),
      input.sourceTaskId
    ),
    input.attachments ?? []
  )
}

/** The visible text, with the files, the posting task and the answered message a line stores after it; a message with none is unchanged. */
export function botTeamRoomMessageFromStored(message: BotTeamMessage): BotTeamMessage {
  const split = splitBotTeamRoomAttachments(message.text)
  const source = splitBotTeamRoomSourceTask(split.text)
  const reply = splitBotTeamRoomReply(source.text)
  return {
    ...message,
    text: reply.text,
    ...(split.attachments.length > 0 ? { attachments: split.attachments } : {}),
    ...(source.sourceTaskId !== null ? { sourceTaskId: source.sourceTaskId } : {}),
    ...(reply.replyToMessageId !== null ? { replyToMessageId: reply.replyToMessageId } : {})
  }
}
