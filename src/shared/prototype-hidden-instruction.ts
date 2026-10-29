// The marker line that opens the hidden instruction of a prototype message, and how a reader
// finds it again: everything from that line on is for the agent, never for the chat bubble.

const REQUEST_ID_SOURCE = '[A-Za-z0-9][A-Za-z0-9_-]{0,127}'
const MARKER_LINE = new RegExp(
  `^[ \t]*<!-- orca-prototype-(request|iteration):(${REQUEST_ID_SOURCE})(?::([A-Z]))? -->[ \t]*$`,
  'mu'
)

export type PrototypeHiddenInstructionMarker =
  | { kind: 'request'; requestId: string }
  | { kind: 'iteration'; requestId: string; letter: string }

export type PrototypeHiddenInstructionSplit = {
  /** What the user wrote: the text before the marker line, without trailing blank space. */
  visibleText: string
  hidden?: PrototypeHiddenInstructionMarker
}

export function prototypeRequestMarkerLine(requestId: string): string {
  return `<!-- orca-prototype-request:${requestId} -->`
}

export function prototypeIterationMarkerLine(requestId: string, letter: string): string {
  return `<!-- orca-prototype-iteration:${requestId}:${letter} -->`
}

/** Separates the visible text of a message from the hidden prototype instruction, if it has one. */
export function splitPrototypeHiddenInstruction(text: string): PrototypeHiddenInstructionSplit {
  const match = MARKER_LINE.exec(text)
  if (!match) {
    return { visibleText: text }
  }
  const [, kind, requestId = '', letter] = match
  const visibleText = text.slice(0, match.index).trimEnd()
  if (kind === 'request' && letter === undefined) {
    return { visibleText, hidden: { kind: 'request', requestId } }
  }
  if (kind === 'iteration' && letter !== undefined) {
    return { visibleText, hidden: { kind: 'iteration', requestId, letter } }
  }
  return { visibleText: text }
}
