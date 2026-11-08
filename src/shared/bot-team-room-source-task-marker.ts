// Why: the room has no column for the task that posted a line, so its id rides in the text the way
// the reply id does; the host strips it before any reader sees the text.
const MARKER_OPEN = '\n<!-- orca-room-source-task '
const MARKER_CLOSE = ' -->'
const TASK_ID = /^[A-Za-z0-9_-]{1,100}$/

/** The text with the id of the task that posted it stored after it; no id, or a malformed one, keeps it as written. */
export function encodeBotTeamRoomSourceTask(
  text: string,
  sourceTaskId: string | undefined
): string {
  return sourceTaskId !== undefined && TASK_ID.test(sourceTaskId)
    ? `${text}${MARKER_OPEN}${sourceTaskId}${MARKER_CLOSE}`
    : text
}

/** The visible text and the task that posted it, read back from what encodeBotTeamRoomSourceTask stored. */
export function splitBotTeamRoomSourceTask(stored: string): {
  text: string
  sourceTaskId: string | null
} {
  const open = stored.lastIndexOf(MARKER_OPEN)
  if (open === -1 || !stored.endsWith(MARKER_CLOSE)) {
    return { text: stored, sourceTaskId: null }
  }
  const id = stored.slice(open + MARKER_OPEN.length, -MARKER_CLOSE.length)
  return TASK_ID.test(id)
    ? { text: stored.slice(0, open), sourceTaskId: id }
    : { text: stored, sourceTaskId: null }
}
