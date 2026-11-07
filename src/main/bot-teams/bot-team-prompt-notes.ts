import { BOT_TEAM_ALL_AUTHOR } from '../../shared/bot-team-greeting'
import type { BotTeamBot } from '../../shared/rpc-contract/bot-team-params'
import type { BotTeamMessage, BotTeamTask } from '../../shared/rpc-contract/bot-team-room-params'

const EXCERPT_MESSAGES = 12
const EXCERPT_MESSAGE_CHARS = 300

/** What every bot can do, so none answers that it cannot or that it is not its job. */
export const BOT_TEAM_UNIVERSAL_CAPABILITY_NOTE =
  'Every bot on a team can create option cards and MassOrca artifacts, whatever its job. Never say that creating one is not your task or that you cannot do it.'

/** Earlier requests in the room and on the board are history: a bot does only its own task. */
export const BOT_TEAM_NO_REDO_NOTE =
  'Do not redo work that is already finished: a report, analysis or file that you or a teammate already made in an earlier task stays as it is, so read it instead of running it again. Do only the task above; earlier requests in the room are history, not new orders.'

/** A file the person asks to keep must land where Files lists it, and the room hears it is saved. */
export const BOT_TEAM_SAVE_FILE_NOTE =
  'When the person asks you to save a file for future reference or as project documentation, write it as a file in your working directory (a docs folder is fine), so it shows in Files, and say in the Conference room that it is saved, by file name only, in your finish line.'

/**
 * Where a bot looks for what the team already knows about a project. The Engram tools carry the
 * name the agent registers them under, and OpenMetadata is read through its read server only.
 */
export const BOT_TEAM_HISTORY_SOURCES_NOTE =
  'For a question about a project\'s history or what was last done on it, check what the team already knows before answering: Engram memory with `mcp__engram__mem_search` and `mcp__engram__mem_context` (read them, do not save from a question), OpenMetadata through its read server named "openmetadata" only (never another OpenMetadata server: no write profile, whatever its name, such as "escritura" or "openmetadata-escritura", and never a tool that creates or changes anything), and the project itself. Use the sources you have; say once which one you could not reach.'

/** The task that posted a quoted line, as it was filed: its title and its request. */
export type BotTeamQuotedTask = { title: string; prompt: string; projectId: string | null }

/** The room message a reply answers: its author's name (null for the person's own line), its text, and its id. */
export type BotTeamReplyQuote = {
  authorName: string | null
  text: string
  /** The room message the reply answers; the reply's task records it, so the room shows the task as typing. */
  messageId?: string
  /** The task that posted the quoted line, when a task did. */
  sourceTask?: BotTeamQuotedTask | null
}

const REPLY_QUOTE_MAX_CHARS = 500
const REPLY_TASK_TITLE_MAX_CHARS = 120
const REPLY_TASK_PROMPT_MAX_CHARS = 1000

/** The text on one line, cut short with an ellipsis past `max` characters. */
function oneLineCut(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

/** The task that posted the quoted line, by its title and request: a bot cannot open that task from the room. */
function quotedTaskSentence(task: BotTeamQuotedTask): string {
  const title = oneLineCut(task.title, REPLY_TASK_TITLE_MAX_CHARS)
  const request = oneLineCut(task.prompt, REPLY_TASK_PROMPT_MAX_CHARS)
  const requestPart = request === '' ? '' : `, for the request "${request}"`
  return `That line came from the task "${title}"${requestPart}.`
}

/** The message a room reply answers, quoted, the task that posted it, and where a request far from the bot's job goes instead. */
export function botTeamReplyNote(quote: BotTeamReplyQuote): string {
  const shown = oneLineCut(quote.text, REPLY_QUOTE_MAX_CHARS)
  const whose =
    quote.authorName === null ? 'their own earlier message' : `${quote.authorName}'s message`
  const note = `The person is replying to ${whose} in the Conference room: "${shown}". Answer that message. If this request is far from your job, hand it to the right teammate with \`orca orchestration team-delegate --bot <name> --text "<task>"\` instead of answering it yourself.`
  return quote.sourceTask ? `${note} ${quotedTaskSentence(quote.sourceTask)}` : note
}

function authorOf(
  message: BotTeamMessage,
  bots: readonly Pick<BotTeamBot, 'id' | 'name'>[]
): string {
  if (message.authorBotId === null) {
    return 'Person'
  }
  if (message.authorBotId === BOT_TEAM_ALL_AUTHOR) {
    return 'Team'
  }
  return bots.find((bot) => bot.id === message.authorBotId)?.name ?? 'Bot'
}

/** The last room messages, one line each and cut short, as a task's bot reads what others said. */
export function botTeamRoomExcerpt(
  messages: readonly BotTeamMessage[],
  bots: readonly Pick<BotTeamBot, 'id' | 'name'>[]
): string[] {
  return messages.slice(-EXCERPT_MESSAGES).map((message) => {
    const flat = message.text.replace(/\s+/g, ' ').trim()
    const text =
      flat.length > EXCERPT_MESSAGE_CHARS ? `${flat.slice(0, EXCERPT_MESSAGE_CHARS - 1)}…` : flat
    return `${authorOf(message, bots)}: ${text}`
  })
}

/** The room lines a task's prompt carries; a reply carries the message it answers in its notes instead. */
export function botTeamTaskRoomExcerpt(
  task: Pick<BotTeamTask, 'answersMessageId'>,
  messages: readonly BotTeamMessage[],
  bots: readonly Pick<BotTeamBot, 'id' | 'name'>[]
): string[] {
  return task.answersMessageId === undefined ? botTeamRoomExcerpt(messages, bots) : []
}

/** How a bot speaks in the room: for its own part, in first person, never about who handed what to whom. */
export const BOT_TEAM_ROOM_VOICE_NOTE =
  'In the Conference room speak only for your own part, in the first person and in the language of the request ("Yo tomaré…", "Yo haré…", "Yo me encargaré de…" for Spanish). Never describe internal hand-offs or delegation there (not "se lo pasé a…", "entregué a…" or "yo cubro… y él…"). Work your own child sessions do is your work: speak of it in the first person, as if you were doing it ("Estoy a la espera de que elijas el tipo de agente para el prototipo"), never "la sesión hija…" or "the child session…". When you finish, post one line that says what you did and names your deliverable by its file name only (or a link), never a file path: the room attaches the file. Name only files you made; each teammate posts its own.'
