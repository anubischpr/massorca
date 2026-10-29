// What the viewer screen reads off a set and its state: the header lines, the direction chips, the
// peek banner, and the labels of the pin sheet.
import { buildDraft } from '../../../src/shared/prototype-draft'
import { latestVersionOf } from '../../../src/shared/prototype-list-model'
import { pinsOf, type PrototypeSetState } from '../../../src/shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'
import { mobilePrototypeAgentLabel } from './mobile-prototype-list-model'

export function isPeeking(state: PrototypeSetState): boolean {
  return state.view !== state.active
}

/** The header: the shown direction and its name, then the agent and where the direction stands. */
export function viewerHeaderLines(
  set: PrototypeListedSet,
  state: PrototypeSetState
): { title: string; subtitle: string } {
  const direction = set.directions.find((candidate) => candidate.letter === state.view)
  const version = latestVersionOf(direction)?.version ?? 1
  return {
    title: direction?.name === undefined ? state.view : `${state.view} · ${direction.name}`,
    subtitle: `${mobilePrototypeAgentLabel(set.agent)} · ${
      isPeeking(state) ? 'peeking' : `iterating · v${version}`
    }`
  }
}

export type ViewerChip = { letter: string; label: string; selected: boolean }

/** The set's directions as chips; a one-direction set has none. */
export function viewerChips(set: PrototypeListedSet, state: PrototypeSetState): ViewerChip[] {
  if (set.directions.length <= 1) {
    return []
  }
  return set.directions.map((direction) => ({
    letter: direction.letter,
    label: direction.letter === state.active ? `${direction.letter} · iterating` : direction.letter,
    selected: direction.letter === state.view
  }))
}

/** The edits of the selected pin, which the Edit tab counts; peeking shows no edits. */
export function selectedPinEditCount(state: PrototypeSetState): number {
  if (state.selectedPinKey === null || isPeeking(state)) {
    return 0
  }
  const draft = buildDraft({
    activeLetter: state.active,
    pins: pinsOf(state, state.active),
    notes: {}
  })
  return (
    draft.groups
      .find((group) => group.pinKey === state.selectedPinKey)
      ?.items.filter((item) => item.field !== 'note').length ?? 0
  )
}

export function noteLabelFor(state: PrototypeSetState): string {
  return isPeeking(state)
    ? `What to take from ${state.view} into ${state.active}`
    : 'Anything Edit can’t do, for this element'
}

export function notePlaceholderFor(state: PrototypeSetState): string {
  return isPeeking(state)
    ? 'e.g. use this wallet button above the card form'
    : 'Describe a change Edit can’t do: animation, behavior, style…'
}

export const NOTE_EXAMPLE_CHIPS = [
  'Animated rainbow border',
  'Shake on error',
  'Glassy background'
] as const

/** An example chip writes its sentence on the selected element. */
export function noteFromExampleChip(chip: string, pinLabel: string): string {
  return `${chip} on the ${pinLabel}.`
}

/** A number the user typed; null while it is not one yet (empty, a lone sign). */
export function parseNumberInput(text: string): number | null {
  if (text.trim() === '') {
    return null
  }
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}
