// What the set screen reads off a set and its state: the main first, each direction's tag, the
// star labels and the Merge button's text.
import type { PrototypeSetState } from '../../../src/shared/prototype-set-state'
import type { PrototypeListedDirection } from '../../../src/shared/rpc-contract/prototype-params'

/** The set's directions with the main first and the others in their own order. */
export function mainFirst(
  directions: readonly PrototypeListedDirection[],
  main: string
): PrototypeListedDirection[] {
  const first = directions.find((direction) => direction.letter === main)
  const others = directions.filter((direction) => direction.letter !== main)
  return first === undefined ? others : [first, ...others]
}

/** "main", the directions a merged one came from ("A + C"), or "read-only". */
export function directionTag(state: PrototypeSetState, letter: string): string {
  if (letter === state.active) {
    return 'main'
  }
  const mergedFrom = state.mergedFrom[letter]
  return mergedFrom === undefined ? 'read-only' : mergedFrom.join(' + ')
}

/** A card's first line: "A · Single column · read-only"; a direction with no name has the letter and tag. */
export function directionCardLine(direction: PrototypeListedDirection, tag: string): string {
  return direction.name === undefined
    ? `${direction.letter} · ${tag}`
    : `${direction.letter} · ${direction.name} · ${tag}`
}

export function starLabelFor(letter: string, starred: boolean): string {
  return `${starred ? 'Unstar' : 'Star'} ${letter} for merge`
}

/** "Merge", or "Merge (2)" with the number of starred directions. */
export function mergeButtonLabel(starCount: number): string {
  return starCount === 0 ? 'Merge' : `Merge (${starCount})`
}
