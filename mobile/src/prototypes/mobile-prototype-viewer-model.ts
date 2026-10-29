// What the viewer screen reads off a set and its state: the header lines, the direction chips, the
// peek banner, and the labels of the pin sheet.
import {
  buildDraft,
  type PrototypeDraftField,
  type PrototypeSize
} from '../../../src/shared/prototype-draft'
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
  // A direction the host lists with no version has no number to show, so none is made up.
  const version = latestVersionOf(direction)?.version
  const standing = isPeeking(state)
    ? 'peeking'
    : version === undefined
      ? 'iterating'
      : `iterating · v${version}`
  return {
    title: direction?.name === undefined ? state.view : `${state.view} · ${direction.name}`,
    subtitle: `${mobilePrototypeAgentLabel(set.agent)} · ${standing}`
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

/** The tab the pin sheet shows: a peeked direction has no Edit section, so its Note tab is the one shown. */
export function shownPinTab(tab: 'edit' | 'note', state: PrototypeSetState): 'edit' | 'note' {
  return isPeeking(state) ? 'note' : tab
}

/** The control a draft item jumped to, while its pin is the one shown; null otherwise. */
export function pulseFieldFor(
  jump: { letter: string; pinKey: string; field: PrototypeDraftField } | null,
  state: PrototypeSetState
): PrototypeDraftField | null {
  return jump !== null && jump.pinKey === state.selectedPinKey && jump.letter === state.view
    ? jump.field
    : null
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

/** The range an Edit number may take; a value typed or stepped past it is pinned to the nearest bound. */
export type NumberBounds = { readonly min: number; readonly max: number }

/** A px size, a percentage and a font size each keep to their own range. */
export const SIZE_PX_BOUNDS: NumberBounds = { min: 0, max: 4000 }
export const SIZE_PERCENT_BOUNDS: NumberBounds = { min: 0, max: 100 }
export const FONT_SIZE_BOUNDS: NumberBounds = { min: 1, max: 200 }

/** The range of a Width or Height number in its unit; `auto` keeps the px range it is stored with. */
export function sizeBoundsOf(unit: PrototypeSize['unit']): NumberBounds {
  return unit === '%' ? SIZE_PERCENT_BOUNDS : SIZE_PX_BOUNDS
}

export function clampToBounds(value: number, bounds: NumberBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, value))
}

/** A number the user typed, pinned into its range; null while it is not one yet (empty, a lone sign). */
export function parseNumberInput(text: string, bounds: NumberBounds): number | null {
  if (text.trim() === '') {
    return null
  }
  const value = Number(text)
  return Number.isFinite(value) ? clampToBounds(value, bounds) : null
}
