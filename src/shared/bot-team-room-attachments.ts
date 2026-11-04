import { z } from 'zod'

/** Most files one room message can carry. */
export const BOT_TEAM_ROOM_ATTACHMENT_LIMIT = 10
/** The team folder's subfolder that holds the files a room message attaches. */
export const BOT_TEAM_ROOM_ATTACHMENT_FOLDER = 'attachments'
/** What a host advertises once it accepts room attachments; an older host never does. */
export const BOT_TEAM_ROOM_ATTACHMENTS_RUNTIME_CAPABILITY = 'bot-team.room-attachments.v1' as const

export type BotTeamRoomAttachment = { path: string; name: string }

// Why: the room has no column for files, so the list rides in the message text after a marker
// that no Markdown or chat text is likely to contain; `<`, `>` and `&` are escaped so `-->` cannot end it early.
const MARKER_OPEN = '\n<!-- orca-room-attachments '
const MARKER_CLOSE = ' -->'

/** A file the room can name: one file directly inside the team folder's attachments folder. */
export function isBotTeamRoomAttachmentPath(path: string): boolean {
  const prefix = `${BOT_TEAM_ROOM_ATTACHMENT_FOLDER}/`
  if (!path.startsWith(prefix)) {
    return false
  }
  const name = path.slice(prefix.length)
  return (
    name !== '' && name !== '.' && name !== '..' && !/[\\/]/.test(name) && !/^[A-Za-z]:/.test(name)
  )
}

function isValidRoomAttachment(attachment: BotTeamRoomAttachment): boolean {
  return (
    isBotTeamRoomAttachmentPath(attachment.path) &&
    attachment.name.length > 0 &&
    attachment.name.length <= 255
  )
}

/** One attached file as the wire and the store carry it. */
export const BotTeamRoomAttachmentSchema = z.object({
  path: z
    .string()
    .refine(isBotTeamRoomAttachmentPath, 'Attachment path is outside the team folder'),
  name: z.string().min(1).max(255)
})

/** The message text with its files stored after it; a message with no files is returned as written. */
export function encodeBotTeamRoomAttachments(
  text: string,
  attachments: readonly BotTeamRoomAttachment[]
): string {
  const valid = attachments.filter(isValidRoomAttachment).slice(0, BOT_TEAM_ROOM_ATTACHMENT_LIMIT)
  if (valid.length === 0) {
    return text
  }
  const json = JSON.stringify(valid).replace(
    /[<>&]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
  return `${text}${MARKER_OPEN}${json}${MARKER_CLOSE}`
}

/** The visible text and its files, read back from what encodeBotTeamRoomAttachments stored. */
export function splitBotTeamRoomAttachments(stored: string): {
  text: string
  attachments: BotTeamRoomAttachment[]
} {
  const open = stored.lastIndexOf(MARKER_OPEN)
  if (open === -1 || !stored.endsWith(MARKER_CLOSE)) {
    return { text: stored, attachments: [] }
  }
  const attachments = parseAttachmentList(
    stored.slice(open + MARKER_OPEN.length, -MARKER_CLOSE.length)
  )
  if (attachments === null) {
    return { text: stored, attachments: [] }
  }
  return { text: stored.slice(0, open), attachments }
}

function parseAttachmentList(json: string): BotTeamRoomAttachment[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  const list = z.array(z.object({ path: z.string(), name: z.string() })).safeParse(parsed)
  if (!list.success) {
    return null
  }
  return list.data.filter(isValidRoomAttachment).slice(0, BOT_TEAM_ROOM_ATTACHMENT_LIMIT)
}

/** The line that names a message's files for a task's prompt; null when there are none. */
export function botTeamRoomAttachmentsNote(
  attachments: readonly BotTeamRoomAttachment[]
): string | null {
  if (attachments.length === 0) {
    return null
  }
  return `Files attached to the team folder: ${attachments.map((attachment) => attachment.path).join(', ')}`
}

/** A conversation line with its files named after it, for a bot's reply. */
export function botTeamRoomTextWithAttachments(
  text: string,
  attachments: readonly BotTeamRoomAttachment[]
): string {
  const note = botTeamRoomAttachmentsNote(attachments)
  return note === null ? text : `${text}\n\n${note}`
}
