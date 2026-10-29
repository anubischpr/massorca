// Groups one chat's prototypes into sets: one set per request, holding lettered directions with
// their versions. An "Iterate on X." message adds a version to the latest set.
import { classifyPrototypeRequest, type PrototypeAgent } from './prototype-request'

export type PrototypeVisual = {
  file: string
  title: string
}

export type PrototypeChatEntry =
  | { role: 'user'; messageId: string; text: string }
  | { role: 'assistant'; messageId: string; text: string; visuals: readonly PrototypeVisual[] }

export type PrototypeVersion = {
  version: number
  file: string
  title: string
  messageId: string
}

export type PrototypeDirection = {
  letter: string
  versions: PrototypeVersion[]
}

// A set made from visuals with no request before them has requestText '' and the reply's id as
// its requestMessageId.
export type PrototypeSet = {
  setId: string
  requestMessageId: string
  requestText: string
  directions: PrototypeDirection[]
}

type Feedback = {
  direction: PrototypeDirection
  consumed: boolean
}

const ITERATE_PATTERN = /^Iterate on ([A-Z]+)\./

export function groupPrototypeSets(
  entries: readonly PrototypeChatEntry[],
  agent: PrototypeAgent
): PrototypeSet[] {
  const sets: PrototypeSet[] = []
  // Receives the visuals of the replies until the next user message.
  let requestSet: PrototypeSet | null = null
  // Receives the first visual of the replies after an iteration message.
  let feedback: Feedback | null = null

  for (const entry of entries) {
    if (entry.role === 'user') {
      requestSet = null
      feedback = null
      const iterated = ITERATE_PATTERN.exec(entry.text.trimStart())?.[1]
      if (iterated !== undefined) {
        feedback = feedbackFor(sets, iterated)
      } else if (classifyPrototypeRequest(entry.text, agent).kind !== 'none') {
        requestSet = {
          setId: `request:${entry.messageId}`,
          requestMessageId: entry.messageId,
          requestText: entry.text.trim(),
          directions: []
        }
        sets.push(requestSet)
      }
      continue
    }
    for (const [index, visual] of entry.visuals.entries()) {
      if (feedback !== null) {
        if (!feedback.consumed) {
          feedback.consumed = true
          addVersion(feedback.direction, visual, entry.messageId)
        }
      } else if (requestSet !== null) {
        addDirection(requestSet, visual, entry.messageId)
      } else {
        sets.push(orphanSet(visual, entry.messageId, index))
      }
    }
  }
  return sets.filter((set) => set.directions.length > 0)
}

// The latest set with directions (a request still waiting for its replies has none), and the
// direction of that letter in it.
function feedbackFor(sets: readonly PrototypeSet[], letter: string): Feedback | null {
  const set = sets.findLast((candidate) => candidate.directions.length > 0)
  const direction = set?.directions.find((candidate) => candidate.letter === letter)
  return direction === undefined ? null : { direction, consumed: false }
}

function addDirection(set: PrototypeSet, visual: PrototypeVisual, messageId: string): void {
  set.directions.push({
    letter: directionLetter(set.directions.length),
    versions: [{ version: 1, file: visual.file, title: visual.title, messageId }]
  })
}

function addVersion(
  direction: PrototypeDirection,
  visual: PrototypeVisual,
  messageId: string
): void {
  direction.versions.push({
    version: direction.versions.length + 1,
    file: visual.file,
    title: visual.title,
    messageId
  })
}

function orphanSet(visual: PrototypeVisual, messageId: string, index: number): PrototypeSet {
  const set: PrototypeSet = {
    setId: `orphan:${messageId}:${index}`,
    requestMessageId: messageId,
    requestText: '',
    directions: []
  }
  addDirection(set, visual, messageId)
  return set
}

// A, B, … Z, then AA, AB, …
function directionLetter(index: number): string {
  let letters = ''
  let rest = index
  do {
    letters = String.fromCharCode(65 + (rest % 26)) + letters
    rest = Math.floor(rest / 26) - 1
  } while (rest >= 0)
  return letters
}
