// The marker line that opens the hidden instruction of a prototype message, and how a reader
// finds it again: everything from that line on is for the agent, never for the chat bubble. When
// the agent's text differs from what the user typed (a /prototype command word), a second marker
// opens an echo of the typed text, which is then what the chat shows.

const REQUEST_ID_SOURCE = '[A-Za-z0-9][A-Za-z0-9_-]{0,127}'
const MARKER_LINE = new RegExp(
  `^[ \t]*<!-- orca-prototype-(request|iteration):(${REQUEST_ID_SOURCE})(?::([A-Z]))? -->[ \t]*$`,
  'mu'
)

const TYPED_MARKER = '<!-- orca-prototype-typed -->'
const TYPED_LINE = /^[ \t]*<!-- orca-prototype-typed -->[ \t]*$/mu
const MARKER_PREFIX = '<!-- orca-prototype-'

export type PrototypeHiddenInstructionMarker =
  | { kind: 'request'; requestId: string }
  | { kind: 'iteration'; requestId: string; letter: string }

export type PrototypeHiddenInstructionSplit = {
  /** What the user wrote: the typed echo when the message has one, else the text before the
   *  marker line, without trailing blank space. */
  visibleText: string
  hidden?: PrototypeHiddenInstructionMarker
}

export function prototypeRequestMarkerLine(requestId: string): string {
  return `<!-- orca-prototype-request:${requestId} -->`
}

/** Opens the user's text as typed, at the end of a message whose agent text differs from it. */
export function prototypeTypedMarkerLine(): string {
  return TYPED_MARKER
}

export function prototypeIterationMarkerLine(requestId: string, letter: string): string {
  return `<!-- orca-prototype-iteration:${requestId}:${letter} -->`
}

/** Separates the visible text of a message from the hidden prototype instruction, if it has one. */
export function splitPrototypeHiddenInstruction(text: string): PrototypeHiddenInstructionSplit {
  // Most text has no marker; this keeps every preview path off the regex.
  if (!text.includes(MARKER_PREFIX)) {
    return { visibleText: text }
  }
  const match = MARKER_LINE.exec(text)
  if (!match) {
    return { visibleText: text }
  }
  const [, kind, requestId = '', letter] = match
  const visibleText = text.slice(0, match.index).trimEnd()
  if (kind === 'request' && letter === undefined) {
    const echo = TYPED_LINE.exec(text.slice(match.index + match[0].length))
    return {
      visibleText:
        echo === null
          ? visibleText
          : text.slice(match.index + match[0].length + echo.index + echo[0].length).trim(),
      hidden: { kind: 'request', requestId }
    }
  }
  if (kind === 'iteration' && letter !== undefined) {
    return { visibleText, hidden: { kind: 'iteration', requestId, letter } }
  }
  return { visibleText: text }
}
