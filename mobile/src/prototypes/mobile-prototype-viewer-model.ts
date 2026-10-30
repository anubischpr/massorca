// What the viewer screen reads off a set and its state: the header lines, the direction chips, and
// the labels of the pin sheet.
import {
  buildDraft,
  type PrototypeDraftField,
  type PrototypeElementState,
  type PrototypeSize
} from '../../../src/shared/prototype-draft'
import { latestVersionOf } from '../../../src/shared/prototype-list-model'
import {
  isReadOnlyView,
  pinsOf,
  type PrototypeSetState
} from '../../../src/shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../src/shared/rpc-contract/prototype-params'

/** The header: the shown direction and its name, then where it stands: "main · v2" or "read-only". */
export function viewerHeaderLines(
  set: PrototypeListedSet,
  state: PrototypeSetState
): { title: string; subtitle: string } {
  const direction = set.directions.find((candidate) => candidate.letter === state.view)
  // A direction the host lists with no version has no number to show, so none is made up.
  const version = latestVersionOf(direction)?.version
  const standing = isReadOnlyView(state)
    ? 'read-only'
    : version === undefined
      ? 'main'
      : `main · v${version}`
  return {
    title: direction?.name === undefined ? state.view : `${state.view} · ${direction.name}`,
    subtitle: standing
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
    label: direction.letter === state.active ? `${direction.letter} · main` : direction.letter,
    selected: direction.letter === state.view
  }))
}

/** The edits of the selected pin, which the Edit tab counts; a read-only direction has no Edit tab. */
export function selectedPinEditCount(state: PrototypeSetState): number {
  if (state.selectedPinKey === null || isReadOnlyView(state)) {
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

/** The control a draft item jumped to, while its pin is the one shown; null otherwise. */
export function pulseFieldFor(
  jump: { letter: string; pinKey: string; field: PrototypeDraftField } | null,
  state: PrototypeSetState
): PrototypeDraftField | null {
  return jump !== null && jump.pinKey === state.selectedPinKey && jump.letter === state.view
    ? jump.field
    : null
}

export const NOTE_LABEL = 'Anything Edit can’t do, for this element'

export const NOTE_PLACEHOLDER = 'Describe a change Edit can’t do: animation, behavior, style…'

export const NOTE_EXAMPLE_CHIPS = [
  'Animated rainbow border',
  'Shake on error',
  'Glassy background'
] as const

/** An example chip writes its sentence on the selected element. */
export function noteFromExampleChip(chip: string, pinLabel: string): string {
  return `${chip} on the ${pinLabel}.`
}

function sizeText(size: PrototypeSize): string {
  return size.unit === 'auto' ? 'auto' : `${size.value}${size.unit}`
}

/** The read-only Size line: "100% × 44px · 14px" is width, height and font size. */
export function readOnlySizeLine(element: PrototypeElementState): string {
  return `${sizeText(element.width)} × ${sizeText(element.height)} · ${element.fontSize}px`
}
