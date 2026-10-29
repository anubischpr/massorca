// Which chat messages ask for prototypes, and the hidden instructions that ask the agent for them.
import { buildPrototypeCountLine, clampPrototypeCount } from './prototype-count-setting'
import {
  prototypeIterationMarkerLine,
  prototypeRequestMarkerLine,
  prototypeTypedMarkerLine
} from './prototype-hidden-instruction'
import { directionLetter, prototypeFileName } from './prototype-request-folder'
import { hasPrototypeKeyword } from './prototype-request-lexicon'

export { splitPrototypeHiddenInstruction } from './prototype-hidden-instruction'
export type {
  PrototypeHiddenInstructionMarker,
  PrototypeHiddenInstructionSplit
} from './prototype-hidden-instruction'

export const PROTOTYPE_AGENTS = ['claude', 'codex', 'antigravity', 'gentle-shell', 'other'] as const

export type PrototypeAgent = (typeof PROTOTYPE_AGENTS)[number]

const GENTLE_SHELL_DESIGN_COMMAND = '/gentle:design'

// Provisional names, kept in this one place. An agent without a verified design command is absent.
export const PROTOTYPE_NATIVE_COMMANDS: Readonly<Partial<Record<PrototypeAgent, string>>> = {
  claude: '/design',
  'gentle-shell': GENTLE_SHELL_DESIGN_COMMAND
}

export type PrototypeRequest =
  | { kind: 'none' }
  | { kind: 'keyword' }
  | { kind: 'command'; command: string; rest: string }

const MASSORCA_COMMANDS: readonly string[] = ['/prototype', '/prototipo']
// Gentle Shell control subcommands. They never ask for a prototype, whichever agent receives them.
const GENTLE_SHELL_CONTROL_SUBCOMMANDS: readonly string[] = ['sync', 'open', 'stop', 'implement']
const ANTIGRAVITY_STITCH_LINE =
  'Do not use Stitch MCP for this request; write the local HTML files instead.'

/** The first whitespace-delimited word, lowercased, and the trimmed text after it. */
function splitHead(text: string): { token: string; rest: string } {
  const trimmed = text.trimStart()
  const [head = ''] = trimmed.split(/\s/, 1)
  return { token: head.toLowerCase(), rest: trimmed.slice(head.length).trim() }
}

function isGentleShellControlSubcommand(rest: string): boolean {
  const [word = ''] = rest.toLowerCase().split(/\s/, 1)
  return GENTLE_SHELL_CONTROL_SUBCOMMANDS.includes(word)
}

export function classifyPrototypeRequest(text: string, agent: PrototypeAgent): PrototypeRequest {
  const { token, rest } = splitHead(text)
  if (token === GENTLE_SHELL_DESIGN_COMMAND && isGentleShellControlSubcommand(rest)) {
    return { kind: 'none' }
  }
  if (MASSORCA_COMMANDS.includes(token) || PROTOTYPE_NATIVE_COMMANDS[agent] === token) {
    return { kind: 'command', command: token, rest }
  }
  return hasPrototypeKeyword(text) ? { kind: 'keyword' } : { kind: 'none' }
}

// Last line of the agent's instruction when the typed text follows it: that text starts with a
// command word the agent must not act on.
const TYPED_ECHO_NOTE =
  'The lines below repeat the message as the user typed it; ignore the command word at their start.'

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u

export type PrototypeRequestInput = {
  text: string
  agent: PrototypeAgent
  count: number
  /** The request this message opens; the marker line that hides the instruction names it. */
  requestId: string
  /** The request folder on this host; `/` or `\` separators both work. */
  folderPath: string
}

export type PrototypeRequestMessage = {
  /** What the user typed; the only text the chat shows. */
  visibleText: string
  /** What the agent receives, hidden instructions included. */
  sentText: string
}

export function buildPrototypeRequestMessage(
  input: PrototypeRequestInput
): PrototypeRequestMessage {
  const request = classifyPrototypeRequest(input.text, input.agent)
  return { visibleText: input.text, sentText: sentTextFor(request, input) }
}

export type PrototypeIterationInput = {
  requestId: string
  letter: string
  nextVersion: number
  folderPath: string
}

/** The hidden suffix of an "Iterate on B." message: its marker line, then where the new version of B is written. */
export function buildPrototypeIterationInstruction({
  requestId,
  letter,
  nextVersion,
  folderPath
}: PrototypeIterationInput): string {
  if (!/^[A-Z]$/u.test(letter) || !Number.isSafeInteger(nextVersion) || nextVersion < 2) {
    throw new RangeError('An iteration needs a direction letter and a version from 2 on')
  }
  assertRequestId(requestId)
  const file = joinFolderPath(folderPath, prototypeFileName(letter, nextVersion))
  return [
    prototypeIterationMarkerLine(requestId, letter),
    `Write the new version of direction ${letter} as ${file}, self-contained with inline CSS and no external network resources, and do not modify other files.`
  ].join('\n')
}

function sentTextFor(request: PrototypeRequest, input: PrototypeRequestInput): string {
  const { text, agent, folderPath } = input
  if (request.kind === 'none') {
    return text
  }
  assertRequestId(input.requestId)
  assertFolderPath(folderPath)
  const directions = clampPrototypeCount(input.count)
  const hidden = [
    prototypeRequestMarkerLine(input.requestId),
    directionInstruction(directions, folderPath, agent)
  ].join('\n')
  if (request.kind === 'command' && MASSORCA_COMMANDS.includes(request.command)) {
    // The agent gets the text without the MassOrca command word, which no agent knows, or the
    // Gentle Shell design command; the chat shows the typed text, echoed at the end.
    const typed = [TYPED_ECHO_NOTE, prototypeTypedMarkerLine(), text.trim()].join('\n')
    return withBody(
      gentleShellDesignCommand(request.rest, agent) ?? request.rest,
      `${hidden}
${typed}`
    )
  }
  return withBody(text.trim(), hidden)
}

// A /prototype instruction on Gentle Shell becomes its design command, unless that command would
// be a control subcommand; then the plain instruction is sent instead.
function gentleShellDesignCommand(rest: string, agent: PrototypeAgent): string | null {
  if (agent !== 'gentle-shell') {
    return null
  }
  const command =
    rest.length > 0 ? `${GENTLE_SHELL_DESIGN_COMMAND} ${rest}` : GENTLE_SHELL_DESIGN_COMMAND
  return classifyPrototypeRequest(command, agent).kind === 'command' ? command : null
}

// The hidden instruction: the line Settings shows first, then where each file goes. Gentle Shell
// writes its own design/ folder, so it gets the line alone.
function directionInstruction(
  directions: number,
  folderPath: string,
  agent: PrototypeAgent
): string {
  const settingsLine = buildPrototypeCountLine(directions)
  if (agent === 'gentle-shell') {
    return settingsLine
  }
  const paths = Array.from({ length: directions }, (_, index) =>
    joinFolderPath(folderPath, prototypeFileName(directionLetter(index), 1))
  )
  const lines =
    directions === 1
      ? [
          settingsLine,
          'Write it with inline CSS and no external network resources, at this exact path:',
          ...paths,
          'Write nothing else in that folder. Do not announce this file as a chat visual. Reply with one line: its letter, a short name, and a one-line tradeoff.'
        ]
      : [
          settingsLine,
          'Write each as ONE file with inline CSS and no external network resources, at these exact paths:',
          ...paths,
          'Write nothing else in that folder. Do not announce these files as chat visuals. Reply with one line per direction: its letter, a short name, and a one-line tradeoff.'
        ]
  if (agent === 'antigravity') {
    lines.push(ANTIGRAVITY_STITCH_LINE)
  }
  return lines.join('\n')
}

function assertRequestId(requestId: string): void {
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new RangeError('A prototype request needs a valid request id')
  }
}

function assertFolderPath(folderPath: string): void {
  if (folderPath.trim().length === 0) {
    throw new RangeError('A prototype request needs its folder path')
  }
}

// Keeps the caller's separators; the file name follows a `/`.
function joinFolderPath(folderPath: string, fileName: string): string {
  assertFolderPath(folderPath)
  const folder = folderPath.trim().replace(/[\\/]+$/u, '')
  if (folder.length === 0) {
    throw new RangeError('A prototype request needs its folder path')
  }
  return `${folder}/${fileName}`
}

function withBody(body: string, tail: string): string {
  return body.length > 0 ? `${body}\n\n${tail}` : tail
}
