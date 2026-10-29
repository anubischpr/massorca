import {
  buildPrototypeCountLine,
  PROTOTYPE_COUNT_MAX,
  PROTOTYPE_COUNT_MIN
} from './prototype-count-setting'

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
// The line MassOrca writes right after a request marker: the Settings line for its count.
const REQUEST_OPENING_LINES: ReadonlySet<string> = new Set(
  Array.from({ length: PROTOTYPE_COUNT_MAX - PROTOTYPE_COUNT_MIN + 1 }, (_, index) =>
    buildPrototypeCountLine(PROTOTYPE_COUNT_MIN + index)
  )
)

export type PrototypeHiddenInstructionMarker =
  | { kind: 'request'; requestId: string }
  | { kind: 'iteration'; requestId: string; letter: string }

export type PrototypeHiddenInstructionSplit = {
  /** What the user wrote: the typed echo when the message has one, else the text before the
   *  marker line, without trailing blank space. */
  visibleText: string
  hidden?: PrototypeHiddenInstructionMarker
}

/** Marker text a user typed or pasted must never be read back as MassOrca's own hidden block. */
export function neutralizePrototypeMarkers(text: string): string {
  return text.includes(MARKER_PREFIX)
    ? text.replaceAll(MARKER_PREFIX, '<!-- orca\u2011prototype-')
    : text
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
  return splitAtFirstMarker(text, () => true)
}

/** Like `splitPrototypeHiddenInstruction`, but only a marker that MassOrca's own instruction follows
 *  counts: a marker copied into a message from elsewhere hides nothing. */
export function splitTrustedPrototypeHiddenInstruction(
  text: string
): PrototypeHiddenInstructionSplit {
  return splitAtFirstMarker(text, opensMassOrcaInstruction)
}

// The first marker, in order, that `trusts` accepts; a line MassOrca never writes is skipped.
function splitAtFirstMarker(
  text: string,
  trusts: (marker: PrototypeHiddenInstructionMarker, after: string) => boolean
): PrototypeHiddenInstructionSplit {
  // Most text has no marker; this keeps every preview path off the regex.
  if (!text.includes(MARKER_PREFIX)) {
    return { visibleText: text }
  }
  const lines = new RegExp(MARKER_LINE.source, 'gmu')
  for (let match = lines.exec(text); match !== null; match = lines.exec(text)) {
    const marker = markerOf(match)
    const end = match.index + match[0].length
    if (marker !== null && trusts(marker, text.slice(end))) {
      return splitAtMarker(text, match.index, end, marker)
    }
  }
  return { visibleText: text }
}

function markerOf(match: RegExpExecArray): PrototypeHiddenInstructionMarker | null {
  const [, kind, requestId = '', letter] = match
  if (kind === 'request' && letter === undefined) {
    return { kind: 'request', requestId }
  }
  if (kind === 'iteration' && letter !== undefined) {
    return { kind: 'iteration', requestId, letter }
  }
  return null
}

function splitAtMarker(
  text: string,
  start: number,
  end: number,
  marker: PrototypeHiddenInstructionMarker
): PrototypeHiddenInstructionSplit {
  const beforeMarker = text.slice(0, start).trimEnd()
  if (marker.kind === 'iteration') {
    return { visibleText: beforeMarker, hidden: marker }
  }
  const echo = TYPED_LINE.exec(text.slice(end))
  return {
    visibleText:
      echo === null ? beforeMarker : text.slice(end + echo.index + echo[0].length).trim(),
    hidden: marker
  }
}

// The line MassOrca's builders write right after a marker: the Settings line of a request, or the
// new-version line of an iteration.
function opensMassOrcaInstruction(
  marker: PrototypeHiddenInstructionMarker,
  after: string
): boolean {
  const line =
    after
      .replace(/^\r?\n/u, '')
      .split('\n', 1)[0]
      ?.replace(/\r$/u, '') ?? ''
  return marker.kind === 'request'
    ? REQUEST_OPENING_LINES.has(line)
    : line.startsWith(`Write the new version of direction ${marker.letter} as `)
}
