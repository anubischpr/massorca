// Which chat messages ask for prototypes, and the prompt the agent receives for them.
import { buildPrototypeCountLine } from './prototype-count-setting'

export type PrototypeAgent = 'claude' | 'codex' | 'antigravity' | 'gentle-shell' | 'other'

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

const PROTOTYPE_KEYWORDS: readonly string[] = [
  'prototype',
  'prototypes',
  'prototipo',
  'prototipos',
  'mockup',
  'mockups',
  'maqueta',
  'maquetas',
  'wireframe',
  'wireframes',
  'design',
  'designs',
  'designing',
  'redesign',
  'diseño',
  'diseños',
  'diseñar',
  'diseña',
  'diseñame',
  'rediseño',
  'rediseñar',
  'rediseña'
]

// Lowercase with accents removed, so `diseño` and `diseno` are the same word.
function foldAccents(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

const KEYWORD_PATTERN = new RegExp(`\\b(?:${PROTOTYPE_KEYWORDS.map(foldAccents).join('|')})\\b`)

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
  return KEYWORD_PATTERN.test(foldAccents(text)) ? { kind: 'keyword' } : { kind: 'none' }
}

export function buildPrototypePrompt(text: string, agent: PrototypeAgent, count: number): string {
  const request = classifyPrototypeRequest(text, agent)
  switch (request.kind) {
    case 'none':
      return text
    case 'keyword':
      return withCountLine(text.trim(), count)
    case 'command':
      if (MASSORCA_COMMANDS.includes(request.command)) {
        return withCountLine(instructionFor(request.rest, agent), count)
      }
      return withCountLine(text.trim(), count)
  }
}

// A /prototype instruction becomes the agent's native command, unless that command would be a
// Gentle Shell control subcommand; the plain instruction is sent then.
function instructionFor(rest: string, agent: PrototypeAgent): string {
  const native = PROTOTYPE_NATIVE_COMMANDS[agent]
  if (native === undefined) {
    return rest
  }
  const translated = rest.length > 0 ? `${native} ${rest}` : native
  return classifyPrototypeRequest(translated, agent).kind === 'command' ? translated : rest
}

function withCountLine(body: string, count: number): string {
  const countLine = buildPrototypeCountLine(count)
  return body.length > 0 ? `${body}\n\n${countLine}` : countLine
}
