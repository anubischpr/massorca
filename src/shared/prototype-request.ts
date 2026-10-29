// Which chat messages ask for prototypes, and the hidden instructions that ask the agent for them.
import { clampPrototypeCount } from './prototype-count-setting'
import { directionLetter, prototypeFileName } from './prototype-request-folder'
import { hasPrototypeKeyword } from './prototype-request-lexicon'

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

export type PrototypeRequestInput = {
  text: string
  agent: PrototypeAgent
  count: number
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
  letter: string
  nextVersion: number
  folderPath: string
}

/** The hidden suffix of an "Iterate on B." message: where the new version of B is written. */
export function buildPrototypeIterationInstruction({
  letter,
  nextVersion,
  folderPath
}: PrototypeIterationInput): string {
  if (!/^[A-Z]$/u.test(letter) || !Number.isSafeInteger(nextVersion) || nextVersion < 2) {
    throw new RangeError('An iteration needs a direction letter and a version from 2 on')
  }
  const file = joinFolderPath(folderPath, prototypeFileName(letter, nextVersion))
  return `Write the new version of direction ${letter} as ${file}, self-contained with inline CSS and no external network resources, and do not modify other files.`
}

function sentTextFor(request: PrototypeRequest, input: PrototypeRequestInput): string {
  const { text, agent, folderPath } = input
  if (request.kind === 'none') {
    return text
  }
  const directions = clampPrototypeCount(input.count)
  if (request.kind === 'command' && MASSORCA_COMMANDS.includes(request.command)) {
    const designCommand = gentleShellDesignCommand(request.rest, agent)
    return designCommand === null
      ? withBody(request.rest, directionInstruction(directions, folderPath, agent))
      : withBody(designCommand, directionSentence(directions))
  }
  if (request.kind === 'command' && agent === 'gentle-shell') {
    return withBody(text.trim(), directionSentence(directions))
  }
  return withBody(text.trim(), directionInstruction(directions, folderPath, agent))
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

// Gentle Shell writes its own design/ folder, so the request only asks for the count.
function directionSentence(directions: number): string {
  return directions === 1
    ? 'Produce 1 design direction.'
    : `Produce ${directions} distinct design directions.`
}

// The hidden instruction for a request folder: one self-contained file per direction, nothing else.
function directionInstruction(
  directions: number,
  folderPath: string,
  agent: PrototypeAgent
): string {
  const paths = Array.from({ length: directions }, (_, index) =>
    joinFolderPath(folderPath, prototypeFileName(directionLetter(index), 1))
  )
  const lines =
    directions === 1
      ? [
          'Produce 1 design direction. Write it as a single self-contained HTML file with inline CSS and no external network resources, at this exact path:',
          ...paths,
          'Write nothing else in that folder. Do not announce this file as a chat visual. Reply with one line: its letter, a short name, and a one-line tradeoff.'
        ]
      : [
          `Produce exactly ${directions} distinct design directions. Write each as ONE self-contained HTML file with inline CSS and no external network resources, at these exact paths:`,
          ...paths,
          'Write nothing else in that folder. Do not announce these files as chat visuals. Reply with one line per direction: its letter, a short name, and a one-line tradeoff.'
        ]
  if (agent === 'antigravity') {
    lines.push(ANTIGRAVITY_STITCH_LINE)
  }
  return lines.join('\n')
}

// Keeps the caller's separators; the file name follows a `/`.
function joinFolderPath(folderPath: string, fileName: string): string {
  const folder = folderPath.replace(/[\\/]+$/u, '')
  if (folder.length === 0) {
    throw new RangeError('A prototype request needs its folder path')
  }
  return `${folder}/${fileName}`
}

function withBody(body: string, tail: string): string {
  return body.length > 0 ? `${body}\n\n${tail}` : tail
}
