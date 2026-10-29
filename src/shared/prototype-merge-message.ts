// The two messages of a merge, each with the visible text the chat shows and a hidden block, opened
// by a merge marker, for the agent: the plan request, and the merge itself.
import {
  mergeBuildInstructionPrefix,
  MERGE_SUGGEST_INSTRUCTION_PREFIX,
  neutralizePrototypeMarkers,
  prototypeMergeMarkerLine
} from './prototype-hidden-instruction'
import type { PrototypeMergeReviewPart } from './prototype-merge-plan'
import { joinFolderPath } from './prototype-request'
import {
  DIRECTION_LETTER_PATTERN,
  PROTOTYPE_DIRECTIONS_FILE_NAME,
  PROTOTYPE_MERGE_PLAN_FILE_NAME,
  prototypeFileName
} from './prototype-request-folder'

export type PrototypeMergeMessage = {
  /** What the chat shows. */
  visibleText: string
  /** What the agent receives, hidden block included. */
  sentText: string
}

export type PrototypeMergeSuggestionInput = {
  requestId: string
  /** The starred directions. */
  letters: readonly string[]
  /** Echoed by the agent in merge-plan.json, so an older plan is never taken for this answer. */
  planId: string
  /** The request folder on the host. */
  folderPath: string
}

export type PrototypeMergeInput = {
  requestId: string
  /** The starred directions the merge combines. */
  letters: readonly string[]
  /** The merged direction to write: the next free letter. */
  letter: string
  parts: readonly PrototypeMergeReviewPart[]
  note: string
  folderPath: string
}

/** "A and C", or "A, B and C". */
export function joinDirectionLetters(letters: readonly string[]): string {
  if (letters.length <= 2) {
    return letters.join(' and ')
  }
  return `${letters.slice(0, -1).join(', ')} and ${letters.at(-1)}`
}

/** "Suggest a merge of A and C." and the instruction to write merge-plan.json and stop. */
export function buildMergeSuggestionMessage(
  input: PrototypeMergeSuggestionInput
): PrototypeMergeMessage {
  assertLetters(input.letters)
  const visibleText = `Suggest a merge of ${joinDirectionLetters(input.letters)}.`
  const plan = joinFolderPath(input.folderPath, PROTOTYPE_MERGE_PLAN_FILE_NAME)
  const shape = JSON.stringify({
    id: input.planId,
    from: input.letters,
    parts: [
      {
        name: '<short name of the part>',
        selector: '<CSS selector of the part>',
        from: '<letter of the direction to take it from>'
      }
    ]
  })
  const hidden = [
    prototypeMergeMarkerLine(input.requestId, 'suggest'),
    `${MERGE_SUGGEST_INSTRUCTION_PREFIX}${plan} and stop. Compare the latest version of directions ${joinDirectionLetters(input.letters)} in this request and list the parts worth combining into one direction, each taken from one of them. The file is JSON of this shape: ${shape}. Do not write the merged direction yet, and do not modify other files.`
  ]
  return { visibleText, sentText: `${visibleText}\n\n${hidden.join('\n')}` }
}

/** "Merge into D." with a line per part and the user's words, then the instruction to write D. */
export function buildMergeMessage(input: PrototypeMergeInput): PrototypeMergeMessage {
  assertLetters([...input.letters, input.letter])
  const lines = [`Merge into ${input.letter}.`]
  for (const part of input.parts) {
    const origin = part.on ? `from ${part.from}` : 'left out'
    lines.push(`${singleLine(part.name)} (${singleLine(part.selector)}): ${origin}`)
  }
  const note = input.note.trim()
  if (note.length > 0) {
    lines.push('', note)
  }
  const visibleText = neutralizePrototypeMarkers(lines.join('\n'))
  const folder = input.folderPath
  const file = joinFolderPath(folder, prototypeFileName(input.letter, 1))
  const directions = joinFolderPath(folder, PROTOTYPE_DIRECTIONS_FILE_NAME)
  const hidden = [
    prototypeMergeMarkerLine(input.requestId, input.letter),
    `${mergeBuildInstructionPrefix(input.letter)}${file}, self-contained with inline CSS and no external network resources, built from the parts above: take each part from the latest version of the direction it names, and leave out the parts marked left out.`,
    `Then add ${input.letter} to ${directions} with the name "Merged from ${input.letters.join(' + ')}" and a one-line tradeoff, keeping its other entries as they are. Do not modify other files.`
  ]
  return { visibleText, sentText: `${visibleText}\n\n${hidden.join('\n')}` }
}

function assertLetters(letters: readonly string[]): void {
  if (!letters.every((letter) => DIRECTION_LETTER_PATTERN.test(letter))) {
    throw new RangeError('A merge names directions by their letters')
  }
}

// Each part stays on one line, so a multi-line name cannot break the list.
function singleLine(value: string): string {
  return value.replace(/\s*\n\s*/gu, ' ')
}
