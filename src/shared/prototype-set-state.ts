import type { NativeChatVisualPickedElement } from './native-chat-visual-annotate'
import {
  isPinTouched,
  type PrototypeDraftField,
  type PrototypeElementState
} from './prototype-draft'
import {
  createSetState,
  DEFAULT_PICKER_HUE,
  pinKeyFor,
  pinsOf,
  selectedPinOf,
  type PrototypeLayout,
  type PrototypePicker,
  type PrototypeSetPin,
  type PrototypeSetState,
  type PrototypeTool,
  type PrototypeViewport
} from './prototype-set-state-model'

export {
  createSetState,
  DEFAULT_PICKER_HUE,
  pinKeyFor,
  pinsOf,
  selectedPinOf,
  type PrototypeLayout,
  type PrototypePicker,
  type PrototypeSetPin,
  type PrototypeSetState,
  type PrototypeTool,
  type PrototypeViewport
}

// The screen state of one prototype set: which direction is the main and which is shown, the pins
// and their edits, the notes, the prompt, the send, the stars and the merge. Every transition is a
// pure function. Invariants: a picker exists only with a selected pin, a selection stays on the
// shown direction, and an element is picked only while annotating. A direction other than the main
// is read-only: it takes no edit and no note, but its own pins, edits and notes stay on it. A
// transition that would break an invariant is refused or clears what it would leave stale. A pin
// nothing has changed or noted is dropped when the selection moves.

/**
 * The state with its main and shown letters still among the set's letters. A letter the set no
 * longer has moves to the first direction; the shown one then follows the main, and its selection
 * goes. A star on a letter the set no longer has goes too, and a merge that names one ends.
 */
export function keepListedLetters(
  state: PrototypeSetState,
  letters: readonly string[]
): PrototypeSetState {
  const listed = (letter: string): boolean => letters.includes(letter)
  const kept = dropUnlistedStars(state, listed)
  if (listed(kept.active) && listed(kept.view)) {
    return kept
  }
  const active = listed(kept.active) ? kept.active : (letters[0] ?? 'A')
  if (listed(kept.view)) {
    return { ...kept, active }
  }
  return {
    ...pruneUntouched(kept, null),
    active,
    view: active,
    selectedPinKey: null,
    picker: null
  }
}

function dropUnlistedStars(
  state: PrototypeSetState,
  listed: (letter: string) => boolean
): PrototypeSetState {
  const starred = state.starred.filter(listed)
  const mergeLost = state.merge !== null && !state.merge.letters.every(listed)
  if (starred.length === state.starred.length && !mergeLost) {
    return state
  }
  return { ...state, starred, merge: mergeLost ? null : state.merge }
}

/**
 * Drops every untouched pin on every direction, except the pin `keep` names. Dropping one never
 * changes the draft, because an untouched pin has no items in it.
 */
function pruneUntouched(
  state: PrototypeSetState,
  keep: { letter: string; pinKey: string } | null
): PrototypeSetState {
  let removed = false
  const pins: Record<string, readonly PrototypeSetPin[]> = {}
  for (const [letter, list] of Object.entries(state.pins)) {
    const kept = list.filter(
      (pin) =>
        (keep?.letter === letter && keep.pinKey === pin.pinKey) ||
        isPinTouched(letter, pin, state.notes[`${letter}:${pin.pinKey}`])
    )
    if (kept.length !== list.length) {
      removed = true
    }
    if (kept.length > 0) {
      pins[letter] = kept
    }
  }
  return removed ? { ...state, pins } : state
}

/** The state without its untouched pins, for a transition that moves the selection elsewhere. */
export function dropUntouchedPins(state: PrototypeSetState): PrototypeSetState {
  return pruneUntouched(state, null)
}

/** Edits and notes go only on the main; any other direction is read-only. */
export function isEditable(state: PrototypeSetState): boolean {
  return state.view === state.active && selectedPinOf(state) !== null
}

/** The shown direction is not the main. */
export function isReadOnlyView(state: PrototypeSetState): boolean {
  return state.view !== state.active
}

/** Leaving the merge view ends a merge that waits for its plan or is under review. */
function leaveMerge(state: PrototypeSetState): PrototypeSetState {
  return state.merge === null ? state : { ...state, merge: null, mergeSendFailed: false }
}

function dirty(state: PrototypeSetState): PrototypeSetState {
  return { ...state, sentMessage: null, sendFailed: false }
}

export function showSet(state: PrototypeSetState): PrototypeSetState {
  return { ...leaveMerge(state), layout: 'set' }
}

export function showFocus(state: PrototypeSetState): PrototypeSetState {
  const left = leaveMerge(state)
  if (left.view === left.active) {
    return { ...left, layout: 'focus' }
  }
  // A selection on a read-only direction does not carry over to the main.
  return {
    ...pruneUntouched(left, null),
    layout: 'focus',
    view: left.active,
    selectedPinKey: null,
    picker: null
  }
}

/**
 * A card in the set grid or an item of the side strip: shows that direction. It never changes the
 * main; only `makeMain` does.
 */
export function openDirection(state: PrototypeSetState, letter: string): PrototypeSetState {
  const left = leaveMerge(state)
  if (letter === left.view) {
    return { ...left, layout: 'focus' }
  }
  return dirty({
    ...pruneUntouched(left, null),
    layout: 'focus',
    view: letter,
    selectedPinKey: null,
    picker: null
  })
}

export function backToActive(state: PrototypeSetState): PrototypeSetState {
  const left = leaveMerge(state)
  return dirty({
    ...pruneUntouched(left, null),
    view: left.active,
    selectedPinKey: null,
    picker: null
  })
}

/**
 * The shown direction becomes the main. The old main keeps its pins, edits and notes, read-only;
 * its unsent items are not part of the new main's draft.
 */
export function makeMain(state: PrototypeSetState): PrototypeSetState {
  const left = leaveMerge(state)
  return dirty({ ...left, active: left.view })
}

/** A star toggles a direction for merge; it changes nothing else, and a merge under way ends. */
export function toggleStar(state: PrototypeSetState, letter: string): PrototypeSetState {
  const starred = state.starred.includes(letter)
    ? state.starred.filter((starredLetter) => starredLetter !== letter)
    : [...state.starred, letter].sort()
  return { ...leaveMerge(state), starred }
}

export function setViewport(
  state: PrototypeSetState,
  viewport: PrototypeViewport
): PrototypeSetState {
  return { ...state, viewport }
}

export function setTool(state: PrototypeSetState, tool: PrototypeTool): PrototypeSetState {
  if (tool === 'browse') {
    return { ...pruneUntouched(state, null), tool, selectedPinKey: null, picker: null }
  }
  return { ...state, tool }
}

/** Selects a pin of the shown direction; a badge reports its click in either tool. */
export function selectPin(state: PrototypeSetState, pinKey: string): PrototypeSetState {
  if (!pinsOf(state, state.view).some((pin) => pin.pinKey === pinKey)) {
    return state
  }
  return {
    ...pruneUntouched(state, { letter: state.view, pinKey }),
    selectedPinKey: pinKey,
    picker: null
  }
}

export function closeSelection(state: PrototypeSetState): PrototypeSetState {
  return { ...pruneUntouched(state, null), selectedPinKey: null, picker: null }
}

/**
 * A click on an element of the shown direction. The first pick of an element makes its pin and
 * keeps its state as the original; a later pick selects that pin, and its state is not taken again.
 * Untouched pins are dropped first, so the new pin takes the next free number. On a read-only
 * direction the pin only shows the element's properties.
 */
export function pickElement(
  state: PrototypeSetState,
  element: NativeChatVisualPickedElement
): PrototypeSetState {
  if (state.tool !== 'annotate') {
    return state
  }
  const letter = state.view
  const pinKey = pinKeyFor(element.selector)
  const kept = pruneUntouched(state, { letter, pinKey })
  const list = pinsOf(kept, letter)
  if (list.some((pin) => pin.pinKey === pinKey)) {
    return { ...kept, selectedPinKey: pinKey, picker: null }
  }
  const pin: PrototypeSetPin = {
    pinKey,
    number: list.reduce((highest, existing) => Math.max(highest, existing.number), 0) + 1,
    label: element.label,
    selector: element.selector,
    htmlSnippet: element.htmlSnippet,
    original: { ...element.state },
    current: { ...element.state },
    rect: element.rect,
    viewport: state.viewport
  }
  const picked = {
    ...kept,
    pins: { ...kept.pins, [letter]: [...list, pin] },
    selectedPinKey: pinKey,
    picker: null
  }
  // Looking at a read-only direction changes nothing the chat was told.
  return letter === state.active ? dirty(picked) : picked
}

/** A click on a numbered pin in the frame. */
export function pinClicked(state: PrototypeSetState, pinKey: string): PrototypeSetState {
  return selectPin(state, pinKey)
}

/** An Edit change on the selected pin. A value put back to its original leaves the draft by itself. */
export function editSelected(
  state: PrototypeSetState,
  patch: Partial<PrototypeElementState>
): PrototypeSetState {
  if (!isEditable(state)) {
    return state
  }
  const list = pinsOf(state, state.view)
  const next = list.map((pin) =>
    pin.pinKey === state.selectedPinKey ? { ...pin, current: { ...pin.current, ...patch } } : pin
  )
  return dirty({ ...state, pins: { ...state.pins, [state.view]: next } })
}

/** The Text color or Fill value the open picker (or a swatch) sets on the selected pin. */
export function setColorField(
  state: PrototypeSetState,
  field: PrototypePicker,
  hex: string
): PrototypeSetState {
  return editSelected(state, field === 'color' ? { color: hex } : { bg: hex })
}

export function setPicker(
  state: PrototypeSetState,
  picker: PrototypePicker | null
): PrototypeSetState {
  // A picker edits the selected pin of the main, so it opens only with one; closing is always allowed.
  if (picker !== null && !isEditable(state)) {
    return state
  }
  return { ...state, picker }
}

export function setHue(state: PrototypeSetState, hue: number): PrototypeSetState {
  return { ...state, hue }
}

/** The note of the selected pin on the shown direction: editable on the main, read-only elsewhere. */
export function noteFor(state: PrototypeSetState): string {
  if (state.selectedPinKey === null) {
    return ''
  }
  return state.notes[`${state.view}:${state.selectedPinKey}`] ?? ''
}

export function setNote(state: PrototypeSetState, text: string): PrototypeSetState {
  // A read-only direction takes no note; the one it has stays visible through `noteFor`.
  if (!isEditable(state)) {
    return state
  }
  const key = `${state.view}:${state.selectedPinKey}`
  return dirty({ ...state, notes: { ...state.notes, [key]: text } })
}

export function setPrompt(state: PrototypeSetState, text: string): PrototypeSetState {
  return dirty({ ...state, prompt: text })
}

/** A draft item: its pin on its direction, its control pulses. */
export type PrototypeDraftTarget = {
  letter: string
  pinKey: string
  field: PrototypeDraftField
}

export function jumpToDraftItem(
  state: PrototypeSetState,
  target: PrototypeDraftTarget
): PrototypeSetState {
  const picker = target.field === 'color' || target.field === 'bg' ? target.field : null
  return {
    ...pruneUntouched(leaveMerge(state), { letter: target.letter, pinKey: target.pinKey }),
    layout: 'focus',
    tool: 'annotate',
    view: target.letter,
    selectedPinKey: target.pinKey,
    picker,
    pulse: { field: target.field, nonce: (state.pulse?.nonce ?? 0) + 1 },
    sentMessage: null
  }
}
