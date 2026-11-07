// Why: the room has no column for the message a line answers, so its id rides in the text the way
// the attached files do; the host strips it before any reader sees the text.
const MARKER_OPEN = '\n<!-- orca-room-reply '
const MARKER_CLOSE = ' -->'
const MESSAGE_ID = /^[A-Za-z0-9_-]{1,100}$/

/** The text with the id of the message it answers stored after it; no id, or a malformed one, keeps it as written. */
export function encodeBotTeamRoomReply(text: string, replyToMessageId: string | undefined): string {
  return replyToMessageId !== undefined && MESSAGE_ID.test(replyToMessageId)
    ? `${text}${MARKER_OPEN}${replyToMessageId}${MARKER_CLOSE}`
    : text
}

/** The visible text and the message it answers, read back from what encodeBotTeamRoomReply stored. */
export function splitBotTeamRoomReply(stored: string): {
  text: string
  replyToMessageId: string | null
} {
  const open = stored.lastIndexOf(MARKER_OPEN)
  if (open === -1 || !stored.endsWith(MARKER_CLOSE)) {
    return { text: stored, replyToMessageId: null }
  }
  const id = stored.slice(open + MARKER_OPEN.length, -MARKER_CLOSE.length)
  return MESSAGE_ID.test(id)
    ? { text: stored.slice(0, open), replyToMessageId: id }
    : { text: stored, replyToMessageId: null }
}
