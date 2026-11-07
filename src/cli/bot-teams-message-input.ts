import type { BotTeamPrototypeChoice } from '../shared/bot-team-prototype-choice'
import {
  BOT_TEAM_ROOM_ATTACHMENT_FOLDER,
  BOT_TEAM_ROOM_ATTACHMENT_LIMIT,
  isBotTeamRoomAttachmentPath,
  type BotTeamRoomAttachment
} from '../shared/bot-team-room-attachments'
import {
  PROTOTYPE_DESIGN_SYSTEM_MODES,
  type PrototypeDesignSystemMode
} from '../shared/prototype-design-system-files'
import { getOptionalJsonFlag, getOptionalNumberFlag, getOptionalStringFlag } from './flags'
import { RuntimeClientError } from './runtime/types'

const STDIN_LIMIT_BYTES = 64 * 1024

/** Everything piped on stdin as UTF-8, refused on a terminal or past the size limit. */
export async function readStdinText(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new RuntimeClientError('invalid_argument', 'stdin payload requested but stdin is a TTY')
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > STDIN_LIMIT_BYTES) {
      throw new RuntimeClientError('invalid_argument', 'The text on stdin is too long.')
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** The message text from --text or --text-stdin; empty only when the caller allows it. */
export async function readMessageText(flags: Map<string, string | boolean>): Promise<string> {
  const text = getOptionalStringFlag(flags, 'text')
  const fromStdin = flags.get('text-stdin') === true
  if (fromStdin && text !== undefined) {
    throw new RuntimeClientError('invalid_argument', 'Use either --text or --text-stdin, not both.')
  }
  return fromStdin ? readStdinText() : (text ?? '')
}

/** A JSON value from --<name>-json or --<name>-stdin; undefined when neither is passed. */
export async function readJsonInput(
  flags: Map<string, string | boolean>,
  name: string
): Promise<unknown> {
  const json = getOptionalJsonFlag(flags, `${name}-json`)
  const fromStdin = flags.get(`${name}-stdin`) === true
  if (fromStdin && json !== undefined) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Use either --${name}-json or --${name}-stdin, not both.`
    )
  }
  const raw = fromStdin ? await readStdinText() : json
  if (raw === undefined) {
    return undefined
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new RuntimeClientError('invalid_argument', `--${name}-json is not valid JSON.`)
  }
}

/** The files named by --attach: each one a file already in the team folder's attachments folder. */
export function parseAttachments(flags: Map<string, string | boolean>): BotTeamRoomAttachment[] {
  const value = getOptionalStringFlag(flags, 'attach')
  if (value === undefined) {
    return []
  }
  const prefix = `${BOT_TEAM_ROOM_ATTACHMENT_FOLDER}/`
  const attachments = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map((path): BotTeamRoomAttachment => {
      if (!isBotTeamRoomAttachmentPath(path)) {
        throw new RuntimeClientError(
          'invalid_argument',
          `--attach ${path} is not a file in the team folder's attachments folder. Use ${prefix}<file name>.`
        )
      }
      return { path, name: path.slice(prefix.length) }
    })
  return mergeAttachments([], attachments)
}

/** Stored files first, then the new ones; a path named twice is kept once. */
export function mergeAttachments(
  stored: readonly BotTeamRoomAttachment[],
  extra: readonly BotTeamRoomAttachment[]
): BotTeamRoomAttachment[] {
  const byPath = new Map<string, BotTeamRoomAttachment>()
  for (const attachment of [...stored, ...extra]) {
    byPath.set(attachment.path, attachment)
  }
  const merged = [...byPath.values()]
  if (merged.length > BOT_TEAM_ROOM_ATTACHMENT_LIMIT) {
    throw new RuntimeClientError(
      'invalid_argument',
      `A room message carries at most ${BOT_TEAM_ROOM_ATTACHMENT_LIMIT} files.`
    )
  }
  return merged
}

function isDesignSystemMode(value: string): value is PrototypeDesignSystemMode {
  return PROTOTYPE_DESIGN_SYSTEM_MODES.some((mode) => mode === value)
}

/** The prototype count (1 to 4) and design-system answer from --prototypes and --design-system. */
export function parsePrototypeChoice(
  flags: Map<string, string | boolean>
): BotTeamPrototypeChoice | undefined {
  const designSystem = getOptionalStringFlag(flags, 'design-system')
  const count = getOptionalNumberFlag(flags, 'prototypes')
  if (count === undefined) {
    if (designSystem !== undefined) {
      throw new RuntimeClientError('invalid_argument', '--design-system needs --prototypes <1-4>.')
    }
    return undefined
  }
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--prototypes takes a whole number from 1 to 4.'
    )
  }
  if (designSystem === undefined) {
    return { count }
  }
  if (!isDesignSystemMode(designSystem)) {
    throw new RuntimeClientError('invalid_argument', '--design-system takes use, propose or skip.')
  }
  return { count, designSystem }
}
