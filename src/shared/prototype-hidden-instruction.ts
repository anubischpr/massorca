import {
  buildPrototypeCountLine,
  PROTOTYPE_COUNT_MAX,
  PROTOTYPE_COUNT_MIN
} from './prototype-count-setting'
import { DESIGN_SYSTEM_FILES_LINE_PREFIX } from './prototype-design-system-files'

// The marker line that opens the hidden instruction of a prototype message, and how a reader
// finds it again: everything from that line on is for the agent, never for the chat bubble. When
// the agent's text differs from what the user typed (a /prototype command word), a second marker
// opens an echo of the typed text, which is then what the chat shows. A design system message
// opens with its own marker: `design-system:update`, `design-system:detect` or
// `design-system:approve:<requestId>`.

const REQUEST_ID_SOURCE = '[A-Za-z0-9][A-Za-z0-9_-]{0,127}'
const MARKER_LINE = new RegExp(
  `^[ \t]*<!-- orca-prototype-(request|iteration|design-system):(${REQUEST_ID_SOURCE})(?::(${REQUEST_ID_SOURCE}))? -->[ \t]*$`,
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

export type PrototypeDesignSystemAction = 'update' | 'detect' | 'approve'

export type PrototypeHiddenInstructionMarker =
  | { kind: 'request'; requestId: string }
  | { kind: 'iteration'; requestId: string; letter: string }
  | { kind: 'design-system'; action: 'update' | 'detect' }
  /** `requestId` is the pending request an `approve` builds the directions of. */
  | { kind: 'design-system'; action: 'approve'; requestId: string }

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

/** Opens the hidden block of a design system message; `approve` names the request it unblocks. */
export function prototypeDesignSystemMarkerLine(
  action: PrototypeDesignSystemAction,
  requestId?: string
): string {
  if ((action === 'approve') !== (requestId !== undefined)) {
    throw new RangeError('Only an approve marker names a request')
  }
  return requestId === undefined
    ? `<!-- orca-prototype-design-system:${action} -->`
    : `<!-- orca-prototype-design-system:${action}:${requestId} -->`
}

export function prototypeIterationMarkerLine(requestId: string, letter: string): string {
  return `<!-- orca-prototype-iteration:${requestId}:${letter} -->`
}

/** The start of the line that follows an iteration marker; the new version's path comes after it. */
export function iterationInstructionPrefix(letter: string): string {
  return `Write the new version of direction ${letter} as `
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
  const [, kind, name = '', third] = match
  if (kind === 'request' && third === undefined) {
    return { kind: 'request', requestId: name }
  }
  if (kind === 'iteration' && third !== undefined && /^[A-Z]$/u.test(third)) {
    return { kind: 'iteration', requestId: name, letter: third }
  }
  return kind === 'design-system' ? designSystemMarkerOf(name, third) : null
}

// The first slot of a design system marker is its action; only `approve` has a request after it.
function designSystemMarkerOf(
  action: string,
  requestId: string | undefined
): PrototypeHiddenInstructionMarker | null {
  if ((action === 'update' || action === 'detect') && requestId === undefined) {
    return { kind: 'design-system', action }
  }
  return action === 'approve' && requestId !== undefined
    ? { kind: 'design-system', action, requestId }
    : null
}

function splitAtMarker(
  text: string,
  start: number,
  end: number,
  marker: PrototypeHiddenInstructionMarker
): PrototypeHiddenInstructionSplit {
  const beforeMarker = text.slice(0, start).trimEnd()
  if (marker.kind !== 'request') {
    return { visibleText: beforeMarker, hidden: marker }
  }
  const echo = TYPED_LINE.exec(text.slice(end))
  return {
    visibleText:
      echo === null ? beforeMarker : text.slice(end + echo.index + echo[0].length).trim(),
    hidden: marker
  }
}

// The line MassOrca's builders write right after a marker: the Settings line of a request, the
// new-version line of an iteration, or the files line of a design system message.
function opensMassOrcaInstruction(
  marker: PrototypeHiddenInstructionMarker,
  after: string
): boolean {
  const line =
    after
      .replace(/^\r?\n/u, '')
      .split('\n', 1)[0]
      ?.replace(/\r$/u, '') ?? ''
  if (marker.kind === 'request') {
    return REQUEST_OPENING_LINES.has(line)
  }
  return marker.kind === 'iteration'
    ? line.startsWith(iterationInstructionPrefix(marker.letter))
    : line.startsWith(DESIGN_SYSTEM_FILES_LINE_PREFIX)
}
