import type {
  NativeChatVisualPickedElement,
  NativeChatVisualRect
} from './native-chat-visual-annotate'
import type {
  PrototypeDraftField,
  PrototypeElementState,
  PrototypeNotes,
  PrototypePin
} from './prototype-draft'

// The screen state of one prototype set: which direction is iterated and which is shown, the pins
// and their edits, the notes, the prompt and the send. Every transition is a pure function.

export type PrototypeLayout = 'set' | 'focus'
export type PrototypeViewport = 'desktop' | 'phone'
export type PrototypeTool = 'browse' | 'annotate'
export type PrototypePicker = 'color' | 'bg'

export type PrototypeSetState = {
  layout: PrototypeLayout
  viewport: PrototypeViewport
  tool: PrototypeTool
  /** The direction being iterated: the one a message goes back about. */
  active: string
  /** The direction on screen; a letter other than `active` is a peek. */
  view: string
  selectedPinKey: string | null
  picker: PrototypePicker | null
  hue: number
  /** Pins by the letter of the direction whose file they sit on. */
  pins: Readonly<Record<string, readonly PrototypeSetPin[]>>
  /** Keyed `${letter}:${pinKey}`, as buildDraft reads them. */
  notes: PrototypeNotes
  prompt: string
  /** The draft item last jumped to: its control pulses once per nonce. */
  pulse: { field: PrototypeDraftField; nonce: number } | null
  sending: boolean
  sendFailed: boolean
  /** The message the last successful send carried, shown until the next change. */
  sentMessage: string | null
}

export const DEFAULT_PICKER_HUE = 210

/** A pin with the frame rectangle and viewport it was picked at, for its screenshot at send. */
export type PrototypeSetPin = PrototypePin & {
  rect: NativeChatVisualRect
  viewport: PrototypeViewport
}

export function createSetState(letters: readonly string[]): PrototypeSetState {
  const first = letters[0] ?? 'A'
  return {
    layout: 'focus',
    viewport: 'desktop',
    tool: 'annotate',
    active: first,
    view: first,
    selectedPinKey: null,
    picker: null,
    hue: DEFAULT_PICKER_HUE,
    pins: {},
    notes: {},
    prompt: '',
    pulse: null,
    sending: false,
    sendFailed: false,
    sentMessage: null
  }
}

/** A pin's key is its selector's hash: the same element on two directions has the same key. */
export function pinKeyFor(selector: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < selector.length; index += 1) {
    hash ^= selector.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `pin-${(hash >>> 0).toString(16)}`
}

export function pinsOf(state: PrototypeSetState, letter: string): readonly PrototypeSetPin[] {
  return state.pins[letter] ?? []
}

export function selectedPinOf(state: PrototypeSetState): PrototypeSetPin | null {
  if (state.selectedPinKey === null) {
    return null
  }
  return pinsOf(state, state.view).find((pin) => pin.pinKey === state.selectedPinKey) ?? null
}

/** Edits apply only to the iterated direction; a peek shows its pins without the Edit section. */
export function isEditable(state: PrototypeSetState): boolean {
  return state.view === state.active && selectedPinOf(state) !== null
}

function dirty(state: PrototypeSetState): PrototypeSetState {
  return { ...state, sentMessage: null, sendFailed: false }
}

export function showSet(state: PrototypeSetState): PrototypeSetState {
  return { ...state, layout: 'set' }
}

export function showFocus(state: PrototypeSetState): PrototypeSetState {
  return { ...state, layout: 'focus', view: state.active }
}

/** A card in the set grid: it becomes the iterated direction and opens focus on it. */
export function openDirection(state: PrototypeSetState, letter: string): PrototypeSetState {
  return dirty({
    ...state,
    layout: 'focus',
    active: letter,
    view: letter,
    selectedPinKey: null,
    picker: null
  })
}

/** A side-strip click: shows the sibling without changing which direction is iterated. */
export function peekDirection(state: PrototypeSetState, letter: string): PrototypeSetState {
  if (letter === state.view) {
    return { ...state, layout: 'focus' }
  }
  return dirty({ ...state, layout: 'focus', view: letter, selectedPinKey: null, picker: null })
}

export function backToActive(state: PrototypeSetState): PrototypeSetState {
  return dirty({ ...state, view: state.active, selectedPinKey: null, picker: null })
}

export function iterateHere(state: PrototypeSetState): PrototypeSetState {
  return dirty({ ...state, active: state.view })
}

export function setViewport(
  state: PrototypeSetState,
  viewport: PrototypeViewport
): PrototypeSetState {
  return { ...state, viewport }
}

export function setTool(state: PrototypeSetState, tool: PrototypeTool): PrototypeSetState {
  if (tool === 'browse') {
    return { ...state, tool, selectedPinKey: null, picker: null }
  }
  return { ...state, tool }
}

export function selectPin(state: PrototypeSetState, pinKey: string): PrototypeSetState {
  if (!pinsOf(state, state.view).some((pin) => pin.pinKey === pinKey)) {
    return state
  }
  return { ...state, selectedPinKey: pinKey, picker: null }
}

export function closeSelection(state: PrototypeSetState): PrototypeSetState {
  return { ...state, selectedPinKey: null, picker: null }
}

/**
 * A click on an element of the shown direction. The first pick of an element makes its pin and
 * keeps its state as the original; a later pick selects that pin, and its state is not taken again.
 */
export function pickElement(
  state: PrototypeSetState,
  element: NativeChatVisualPickedElement
): PrototypeSetState {
  const letter = state.view
  const list = pinsOf(state, letter)
  const pinKey = pinKeyFor(element.selector)
  if (list.some((pin) => pin.pinKey === pinKey)) {
    return { ...state, selectedPinKey: pinKey, picker: null }
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
  return dirty({
    ...state,
    pins: { ...state.pins, [letter]: [...list, pin] },
    selectedPinKey: pinKey,
    picker: null
  })
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
  return { ...state, picker }
}

export function setHue(state: PrototypeSetState, hue: number): PrototypeSetState {
  return { ...state, hue }
}

/** The note of the selected pin, on the shown direction. */
export function noteFor(state: PrototypeSetState): string {
  if (state.selectedPinKey === null) {
    return ''
  }
  return state.notes[`${state.view}:${state.selectedPinKey}`] ?? ''
}

export function setNote(state: PrototypeSetState, text: string): PrototypeSetState {
  if (state.selectedPinKey === null || selectedPinOf(state) === null) {
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
    ...state,
    layout: 'focus',
    tool: 'annotate',
    view: target.letter,
    selectedPinKey: target.pinKey,
    picker,
    pulse: { field: target.field, nonce: (state.pulse?.nonce ?? 0) + 1 },
    sentMessage: null
  }
}
